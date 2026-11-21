import type { Prisma, PrismaClient } from "@prisma/client";
import { filters, money } from "../lib/input";
import { HttpError } from "../lib/http-error";

export async function checkedFilters(
  db: PrismaClient,
  query: Record<string, unknown>,
) {
  const filter = filters(query);
  if (
    filter.viveiroId &&
    !(await db.viveiro.findUnique({
      where: { id: filter.viveiroId },
      select: { id: true },
    }))
  )
    throw new HttpError(404, "Viveiro não encontrado.");
  if (filter.cicloId) {
    const cycle = await db.cicloCultivo.findUnique({
      where: { id: filter.cicloId },
      select: { viveiroId: true },
    });
    if (!cycle) throw new HttpError(404, "Ciclo não encontrado.");
    if (filter.viveiroId && cycle.viveiroId !== filter.viveiroId)
      throw new HttpError(400, "O ciclo não pertence ao viveiro informado.");
  }
  return filter;
}
export async function summary(
  db: PrismaClient,
  query: Record<string, unknown>,
  admin: boolean,
) {
  const filter = await checkedFilters(db, query);
  const cycleWhere: Prisma.CicloCultivoWhereInput = {
    ...(filter.viveiroId ? { viveiroId: filter.viveiroId } : {}),
    ...(filter.cicloId ? { id: filter.cicloId } : {}),
  };
  const pondWhere: Prisma.ViveiroWhereInput = {
    ...(filter.viveiroId ? { id: filter.viveiroId } : {}),
    ...(filter.cicloId ? { ciclos: { some: { id: filter.cicloId } } } : {}),
  };
  return db.$transaction(
    async (tx) => {
      const [situacoes, ciclosAtivos, alertasPendentes] = await Promise.all([
        tx.viveiro.groupBy({ by: ["status"], where: pondWhere, _count: true }),
        tx.cicloCultivo.count({ where: { ...cycleWhere, status: "ATIVO" } }),
        tx.alerta.count({
          where: { status: "PENDENTE", medicao: { ciclo: cycleWhere } },
        }),
      ]);
      const viveiros = Object.fromEntries(
        ["DISPONIVEL", "OCUPADO", "MANUTENCAO", "INATIVO"].map((status) => [
          status,
          situacoes.find((row) => row.status === status)?._count ?? 0,
        ]),
      );
      const operational = {
        viveiros,
        ciclosAtivos,
        alertasPendentes,
        atualizadoEm: new Date().toISOString(),
      };
      if (!admin) return operational;
      const [expenses, sales] = await Promise.all([
        tx.compraDespesa.aggregate({
          where: filter,
          _sum: { valorTotal: true },
        }),
        tx.venda.aggregate({
          where: filter,
          _sum: { valorTotal: true, pesoTotalKg: true },
        }),
      ]);
      const despesas = money(expenses._sum.valorTotal ?? 0);
      const receitas = money(sales._sum.valorTotal ?? 0);
      return {
        ...operational,
        financeiro: {
          despesas,
          receitas,
          saldoRegistrado: money(receitas - despesas),
          pesoVendidoKg: sales._sum.pesoTotalKg ?? 0,
        },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
