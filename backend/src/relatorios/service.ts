import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
import { checkedFilters, summary } from "../indicadores/service";
import { money, page } from "../lib/input";
const rounded = (value: number, places = 4) => Number(value.toFixed(places));

export async function managementReport(
  db: PrismaClient,
  query: Record<string, unknown>,
) {
  const filter = await checkedFilters(db, query);
  const pagination = page(query);
  const cycleWhere: Prisma.CicloCultivoWhereInput = {
    ...(filter.viveiroId ? { viveiroId: filter.viveiroId } : {}),
    ...(filter.cicloId ? { id: filter.cicloId } : {}),
    ...(filter.data ? { dataEncerramento: filter.data } : {}),
  };
  const [cycles, total, categories, totals] = await Promise.all([
    db.cicloCultivo.findMany({
      where: cycleWhere,
      ...pagination,
      include: {
        viveiro: { select: { identificador: true } },
        despesas: { select: { valorTotal: true } },
        vendas: { select: { valorTotal: true, pesoTotalKg: true } },
      },
      orderBy: [{ dataInicio: "desc" }, { id: "desc" }],
    }),
    db.cicloCultivo.count({ where: cycleWhere }),
    db.itemCompra.groupBy({
      by: ["categoria"],
      where: { compra: filter },
      _sum: { valorTotalItem: true },
    }),
    summary(db, query, true),
  ]);
  const clauses = [Prisma.sql`1=1`];
  if (filter.viveiroId)
    clauses.push(Prisma.sql`"viveiroId" = ${filter.viveiroId}`);
  if (filter.cicloId) clauses.push(Prisma.sql`"cicloId" = ${filter.cicloId}`);
  if (filter.data?.gte) clauses.push(Prisma.sql`"data" >= ${filter.data.gte}`);
  if (filter.data?.lte) clauses.push(Prisma.sql`"data" <= ${filter.data.lte}`);
  const where = Prisma.join(clauses, " AND ");
  const series = await db.$queryRaw<
    Array<{ dia: string; despesas: Prisma.Decimal; receitas: Prisma.Decimal }>
  >(Prisma.sql`
    WITH costs AS (SELECT TO_CHAR("data", 'YYYY-MM-DD') AS dia, SUM("valorTotal"::numeric) AS valor FROM "CompraDespesa" WHERE ${where} GROUP BY 1),
    sales AS (SELECT TO_CHAR("data", 'YYYY-MM-DD') AS dia, SUM("valorTotal"::numeric) AS valor FROM "Venda" WHERE ${where} GROUP BY 1)
    SELECT COALESCE(costs.dia, sales.dia) AS dia, COALESCE(costs.valor, 0) AS despesas, COALESCE(sales.valor, 0) AS receitas FROM costs FULL OUTER JOIN sales ON costs.dia = sales.dia ORDER BY 1
  `);
  const ciclos = cycles.map((cycle) => {
    const despesasRegistradas = money(
      cycle.despesas.reduce((sum, item) => sum + item.valorTotal, 0),
    );
    const receitaRegistrada = money(
      cycle.vendas.reduce((sum, item) => sum + item.valorTotal, 0),
    );
    const closed =
      cycle.status === "FINALIZADO" && cycle.dataEncerramento !== null;
    const peso = closed ? cycle.pesoFinal : null;
    return {
      id: cycle.id,
      viveiroId: cycle.viveiroId,
      viveiro: cycle.viveiro.identificador,
      status: cycle.status,
      motivoEncerramento: cycle.motivoEncerramento,
      dataInicio: cycle.dataInicio,
      dataEncerramento: cycle.dataEncerramento,
      areaPovoamentoM2: cycle.areaPovoamentoM2,
      pesoFinalKg: peso,
      quantidadeInicial: cycle.qtdLarvasInicial,
      quantidadeFinal: cycle.quantidadeFinal,
      despesasRegistradas,
      receitaRegistrada,
      saldoRegistrado: money(receitaRegistrada - despesasRegistradas),
      diasCultivo: closed
        ? Math.max(
            0,
            Math.floor(
              DateTime.fromJSDate(cycle.dataEncerramento!, {
                zone: "America/Sao_Paulo",
              })
                .startOf("day")
                .diff(
                  DateTime.fromISO(
                    cycle.dataInicio.toISOString().slice(0, 10),
                    { zone: "America/Sao_Paulo" },
                  ),
                  "days",
                ).days,
            ),
          )
        : null,
      sobrevivenciaPercentual:
        closed && cycle.quantidadeFinal !== null
          ? rounded((cycle.quantidadeFinal / cycle.qtdLarvasInicial) * 100, 2)
          : null,
      produtividadeKgHa:
        peso !== null && cycle.areaPovoamentoM2
          ? rounded((peso / cycle.areaPovoamentoM2) * 10000)
          : null,
      custoRegistradoPorKg:
        peso !== null && peso > 0 ? rounded(despesasRegistradas / peso) : null,
      pesoMedioFinalG:
        peso !== null &&
        cycle.quantidadeFinal !== null &&
        cycle.quantidadeFinal > 0
          ? rounded((peso * 1000) / cycle.quantidadeFinal)
          : null,
      dadosFaltantes: [
        !closed ? "Ciclo em andamento ou sem encerramento registrado." : null,
        closed && cycle.quantidadeFinal === null
          ? "Quantidade final não registrada."
          : null,
        !cycle.areaPovoamentoM2 ? "Área no povoamento não registrada." : null,
        closed && !peso ? "Sem produção para calcular custo por kg." : null,
      ].filter((value): value is string => value !== null),
    };
  });
  return {
    resumo: totals,
    ciclos,
    total,
    limite: pagination.take,
    offset: pagination.skip,
    custosPorCategoria: categories.map((row) => ({
      categoria: row.categoria,
      valor: money(row._sum.valorTotalItem ?? 0),
    })),
    financeiroPorDia: series.map((row) => ({
      dia: row.dia,
      despesas: money(Number(row.despesas)),
      receitas: money(Number(row.receitas)),
    })),
  };
}
