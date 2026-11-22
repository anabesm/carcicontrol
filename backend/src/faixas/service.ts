import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../lib/http-error";
import {
  bodyObject,
  integer,
  number,
  optionalId,
  optionalText,
} from "../lib/input";
export function validateRange(value: unknown) {
  const body = bodyObject(value, [
    "parametroId",
    "viveiroId",
    "minIdeal",
    "maxIdeal",
    "minCritico",
    "maxCritico",
    "faseNome",
    "diaInicial",
    "diaFinal",
    "descricao",
    "demonstrativa",
    "minAcaoRecomendada",
    "maxAcaoRecomendada",
  ]);
  const faseNome = optionalText(body.faseNome, "Fase", 80);
  const diaInicial =
    body.diaInicial == null
      ? 0
      : integer(body.diaInicial, "Dia inicial", 0, 3650);
  const diaFinal =
    body.diaFinal == null
      ? null
      : integer(body.diaFinal, "Dia final", diaInicial, 3650);
  if (!faseNome && (diaInicial !== 0 || diaFinal !== null))
    throw new HttpError(400, "Informe o nome da fase para limitar os dias.");
  if (
    body.demonstrativa !== undefined &&
    typeof body.demonstrativa !== "boolean"
  )
    throw new HttpError(400, "A identificação de exemplo deve ser booleana.");
  return {
    parametroId: integer(body.parametroId, "Parâmetro"),
    viveiroId: optionalId(body.viveiroId),
    minIdeal: number(body.minIdeal, "Mínimo ideal", -1_000_000),
    maxIdeal: number(body.maxIdeal, "Máximo ideal", -1_000_000),
    minCritico:
      body.minCritico == null
        ? null
        : number(body.minCritico, "Mínimo crítico", -1_000_000),
    maxCritico:
      body.maxCritico == null
        ? null
        : number(body.maxCritico, "Máximo crítico", -1_000_000),
    faseNome,
    diaInicial,
    diaFinal,
    descricao: optionalText(body.descricao, "Descrição", 1000),
    demonstrativa: body.demonstrativa === true,
    minAcaoRecomendada: optionalText(
      body.minAcaoRecomendada,
      "Ação abaixo da faixa",
      1000,
    ),
    maxAcaoRecomendada: optionalText(
      body.maxAcaoRecomendada,
      "Ação acima da faixa",
      1000,
    ),
  };
}
export async function saveRange(
  db: PrismaClient,
  input: ReturnType<typeof validateRange>,
  userId: number,
  previousId?: number,
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(9172630)`;
    if (
      previousId !== undefined &&
      !(await tx.faixaParametro.findUnique({
        where: { id: previousId },
        select: { id: true },
      }))
    )
      throw new HttpError(404, "Faixa não encontrada.");
    const parameter = await tx.parametro.findFirst({
      where: { id: input.parametroId, ativo: true },
    });
    if (!parameter) throw new HttpError(404, "Parâmetro ativo não encontrado.");
    if (
      input.viveiroId &&
      !(await tx.viveiro.findUnique({
        where: { id: input.viveiroId },
        select: { id: true },
      }))
    )
      throw new HttpError(404, "Viveiro não encontrado.");
    if (
      parameter.minPossivel === null ||
      parameter.maxPossivel === null ||
      input.minIdeal < parameter.minPossivel ||
      input.maxIdeal > parameter.maxPossivel ||
      input.minIdeal > input.maxIdeal ||
      (input.minCritico !== null &&
        (input.minCritico < parameter.minPossivel ||
          input.minCritico > input.minIdeal)) ||
      (input.maxCritico !== null &&
        (input.maxCritico > parameter.maxPossivel ||
          input.maxCritico < input.maxIdeal))
    )
      throw new HttpError(
        400,
        "Os limites ideais e críticos devem ser coerentes com os limites do parâmetro.",
      );
    const existing = await tx.faixaParametro.findMany({
      where: {
        parametroId: input.parametroId,
        viveiroId: input.viveiroId,
        ativo: true,
        ...(previousId ? { id: { not: previousId } } : {}),
      },
    });
    const overlap = existing.some((range) =>
      input.faseNome
        ? range.faseNome !== null &&
          input.diaInicial <= (range.diaFinal ?? Infinity) &&
          range.diaInicial <= (input.diaFinal ?? Infinity)
        : range.faseNome === null,
    );
    if (overlap)
      throw new HttpError(
        409,
        "Já existe uma faixa padrão ou uma fase sobreposta para este parâmetro e viveiro.",
      );
    if (previousId !== undefined)
      await tx.faixaParametro.update({
        where: { id: previousId },
        data: { ativo: false },
      });
    return tx.faixaParametro.create({ data: { ...input, criadoPor: userId } });
  });
}
