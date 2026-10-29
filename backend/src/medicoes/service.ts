import type { Prisma, PrismaClient, StatusCiclo } from "@prisma/client";
import { HttpError } from "../lib/http-error";
import { supportedCodes } from "./definitions";
import { assessValue, resolveFaixa } from "./rules";
import {
  alertaBaseSelect,
  medicaoBaseSelect,
  medicaoPublicSelect,
  parametroConfigSelect,
  publicMedicao,
} from "./selects";
import type { historyQuery, validateNewMedicao } from "./validation";

type LockedCycle = { id: number; viveiroId: number; status: StatusCiclo; dataInicio: Date };

export async function recordMedicao(
  db: PrismaClient,
  input: ReturnType<typeof validateNewMedicao>,
  registradoPorId: number,
) {
  const row = await db.$transaction(async (tx) => {
    // O encerramento do ciclo também precisa atualizar esta linha, aguardando a medição em curso.
    const cycles = await tx.$queryRaw<
      LockedCycle[]
    >`SELECT "id", "viveiroId", "status", "dataInicio" FROM "CicloCultivo" WHERE "id" = ${input.cicloId} FOR UPDATE`;
    const cycle = cycles[0];
    if (!cycle) throw new HttpError(404, "Ciclo não encontrado.");
    if (cycle.status !== "ATIVO")
      throw new HttpError(409, "Somente ciclos ativos podem receber medições.");
    if (input.medidoEm < cycle.dataInicio)
      throw new HttpError(400, "A medição não pode ser anterior ao início do ciclo.");

    const parameter = await tx.parametro.findUnique({
      where: { id: input.parametroId },
      select: parametroConfigSelect,
    });
    if (!parameter) throw new HttpError(404, "Parâmetro não encontrado.");
    if (!parameter.ativo || !supportedCodes.some((code) => code === parameter.codigo))
      throw new HttpError(400, "Parâmetro indisponível para registro de medições.");
    if (input.unidade !== parameter.unidadePadrao)
      throw new HttpError(
        400,
        `Unidade inválida. Use ${parameter.unidadePadrao} para ${parameter.nome}.`,
      );
    const range = resolveFaixa(parameter, cycle.viveiroId);
    const assessment = assessValue(parameter, range, input.valor);
    const anomaly = assessment.direction !== null;

    if (anomaly && !input.confirmarAnomalia) {
      throw new HttpError(
        409,
        "O valor está fora da faixa ideal. Confirme a anomalia para registrar a medição.",
        {
          codigo: "CONFIRMACAO_ANOMALIA_NECESSARIA",
          parametro: { id: parameter.id, nome: parameter.nome },
          cicloId: cycle.id,
          valor: input.valor,
          unidade: parameter.unidadePadrao,
          medidoEm: input.medidoEm.toISOString(),
          faixaIdeal: {
            id: range.id,
            minIdeal: range.minIdeal,
            maxIdeal: range.maxIdeal,
            demonstrativa: range.demonstrativa,
            descricao: range.descricao,
          },
          direcao: assessment.direction,
        },
      );
    }

    return tx.medicao.create({
      data: {
        cicloId: cycle.id,
        parametroId: parameter.id,
        valor: input.valor,
        unidade: parameter.unidadePadrao,
        medidoEm: input.medidoEm,
        registradoPorId,
        confirmadaForaFaixa: anomaly,
        faixaParametroId: range.id,
        minIdealAplicado: range.minIdeal,
        maxIdealAplicado: range.maxIdeal,
        faixaDemonstrativa: range.demonstrativa,
        ...(anomaly
          ? {
              alertas: {
                create: {
                  valorMedido: input.valor,
                  limiteViolado: assessment.limiteViolado,
                  gravidade: assessment.gravidade,
                  status: "PENDENTE",
                  observacao: range.demonstrativa
                    ? "Alerta gerado a partir de faixa demonstrativa (exemplo)."
                    : null,
                },
              },
            }
          : {}),
      },
      select: medicaoPublicSelect,
    });
  });
  return publicMedicao(row);
}

export async function listParameters(db: PrismaClient, cicloId?: number) {
  const cycle =
    cicloId === undefined
      ? null
      : await db.cicloCultivo.findUnique({ where: { id: cicloId }, select: { viveiroId: true } });
  if (cicloId !== undefined && !cycle) throw new HttpError(404, "Ciclo não encontrado.");
  const parameters = await db.parametro.findMany({
    where: { ativo: true, codigo: { in: supportedCodes } },
    select: parametroConfigSelect,
    orderBy: { nome: "asc" },
  });
  return parameters.map((parameter) => {
    const range = resolveFaixa(parameter, cycle?.viveiroId);
    return {
      id: parameter.id,
      codigo: parameter.codigo,
      nome: parameter.nome,
      unidadePadrao: parameter.unidadePadrao,
      minPossivel: parameter.minPossivel,
      maxPossivel: parameter.maxPossivel,
      faixaIdeal: {
        id: range.id,
        minIdeal: range.minIdeal,
        maxIdeal: range.maxIdeal,
        minCritico: range.minCritico,
        maxCritico: range.maxCritico,
        demonstrativa: range.demonstrativa,
        descricao: range.descricao,
      },
    };
  });
}

type HistoryFilter = ReturnType<typeof historyQuery>;
async function checkFilters(db: PrismaClient, filter: HistoryFilter) {
  if (
    filter.cicloId !== undefined &&
    !(await db.cicloCultivo.findUnique({ where: { id: filter.cicloId }, select: { id: true } }))
  )
    throw new HttpError(404, "Ciclo não encontrado.");
  if (
    filter.parametroId !== undefined &&
    !(await db.parametro.findUnique({ where: { id: filter.parametroId }, select: { id: true } }))
  )
    throw new HttpError(404, "Parâmetro não encontrado.");
}

export async function listMedicoes(db: PrismaClient, filter: HistoryFilter) {
  await checkFilters(db, filter);
  const where: Prisma.MedicaoWhereInput = {
    ...(filter.cicloId === undefined ? {} : { cicloId: filter.cicloId }),
    ...(filter.parametroId === undefined ? {} : { parametroId: filter.parametroId }),
  };
  const [rows, total] = await db.$transaction(
    [
      db.medicao.findMany({
        where,
        select: medicaoPublicSelect,
        orderBy: [{ medidoEm: "desc" }, { id: "desc" }],
        take: filter.limite,
        skip: filter.offset,
      }),
      db.medicao.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return { medicoes: rows.map(publicMedicao), total, limite: filter.limite, offset: filter.offset };
}

export async function listAlertas(db: PrismaClient, filter: HistoryFilter) {
  await checkFilters(db, filter);
  const where: Prisma.AlertaWhereInput = {
    ...(filter.status === undefined ? {} : { status: filter.status }),
    medicao: {
      ...(filter.cicloId === undefined ? {} : { cicloId: filter.cicloId }),
      ...(filter.parametroId === undefined ? {} : { parametroId: filter.parametroId }),
    },
  };
  const [rows, total] = await db.$transaction(
    [
      db.alerta.findMany({
        where,
        select: { ...alertaBaseSelect, medicao: { select: medicaoBaseSelect } },
        orderBy: [{ dataHora: "desc" }, { id: "desc" }],
        take: filter.limite,
        skip: filter.offset,
      }),
      db.alerta.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    alertas: rows.map((row) => ({ ...row, medicao: publicMedicao(row.medicao) })),
    total,
    limite: filter.limite,
    offset: filter.offset,
  };
}
