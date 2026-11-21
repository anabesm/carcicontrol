import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../lib/http-error";
import {
  bodyObject,
  date,
  integer,
  number,
  optionalText,
  text,
} from "../lib/input";
import { cicloPublicoSelect } from "./viveiro";

export function validateClosing(input: unknown) {
  const body = bodyObject(input, [
    "motivo",
    "dataEncerramento",
    "justificativa",
    "observacao",
    "compradorNome",
    "pesoTotalKg",
    "precoPorKg",
    "biometria",
    "quantidadeFinal",
  ]);
  const dataEncerramento = date(body.dataEncerramento, "Encerramento");
  const observacao = optionalText(body.observacao, "Observação", 2000);
  if (body.motivo === "PERDA_TOTAL") {
    if (
      [
        "compradorNome",
        "pesoTotalKg",
        "precoPorKg",
        "biometria",
        "quantidadeFinal",
      ].some((key) => body[key] !== undefined)
    )
      throw new HttpError(400, "Perda total não deve conter dados de venda.");
    return {
      motivo: "PERDA_TOTAL" as const,
      dataEncerramento,
      justificativa: text(body.justificativa, "Justificativa", 2000),
      observacao,
      venda: null,
      quantidadeFinal: 0,
    };
  }
  if (body.motivo !== "VENDA")
    throw new HttpError(400, "Selecione venda ou perda total.");
  if (body.justificativa !== undefined)
    throw new HttpError(400, "Justificativa é exclusiva de perda total.");
  const pesoTotalKg = number(body.pesoTotalKg, "Peso (kg)", 0.001, 1_000_000);
  const precoPorKg = number(body.precoPorKg, "Preço por kg", 0.01, 1_000_000);
  if (
    new Prisma.Decimal(precoPorKg).decimalPlaces() > 2 ||
    new Prisma.Decimal(pesoTotalKg).decimalPlaces() > 3
  )
    throw new HttpError(400, "Use até duas casas no preço e três no peso.");
  const valorTotal = new Prisma.Decimal(pesoTotalKg)
    .mul(precoPorKg)
    .toDecimalPlaces(2)
    .toNumber();
  if (valorTotal <= 0 || valorTotal > 1_000_000_000)
    throw new HttpError(400, "Receita fora do limite permitido.");
  return {
    motivo: "VENDA" as const,
    dataEncerramento,
    justificativa: null,
    observacao,
    quantidadeFinal:
      body.quantidadeFinal == null
        ? null
        : integer(body.quantidadeFinal, "Quantidade final", 1),
    venda: {
      compradorNome: text(body.compradorNome, "Comprador", 160),
      pesoTotalKg,
      precoPorKg,
      valorTotal,
      biometria: optionalText(body.biometria, "Biometria", 240),
    },
  };
}

export async function closeCycle(
  db: PrismaClient,
  viveiroId: number,
  cicloId: number,
  input: ReturnType<typeof validateClosing>,
  criadoPor: number,
) {
  return db.$transaction(async (tx) => {
    const ponds = await tx.$queryRaw<
      Array<{ id: number; status: string }>
    >`SELECT "id", "status" FROM "Viveiro" WHERE "id" = ${viveiroId} FOR UPDATE`;
    if (!ponds[0]) throw new HttpError(404, "Viveiro não encontrado.");
    await tx.$queryRaw`SELECT "id" FROM "CicloCultivo" WHERE "id" = ${cicloId} FOR UPDATE`;
    const cycle = await tx.cicloCultivo.findUnique({ where: { id: cicloId } });
    if (!cycle || cycle.viveiroId !== viveiroId)
      throw new HttpError(404, "Ciclo não encontrado neste viveiro.");
    if (cycle.status !== "ATIVO" || ponds[0].status !== "OCUPADO")
      throw new HttpError(
        409,
        "Este ciclo já foi encerrado ou o viveiro está indisponível.",
      );
    if (input.dataEncerramento < cycle.dataInicio)
      throw new HttpError(400, "Encerramento anterior ao início do ciclo.");
    if (
      input.quantidadeFinal !== null &&
      input.quantidadeFinal > cycle.qtdLarvasInicial
    )
      throw new HttpError(
        400,
        "A quantidade final não pode superar o povoamento inicial.",
      );
    const [measurement, event, expense, existingSale] = await Promise.all([
      tx.medicao.findFirst({
        where: { cicloId },
        orderBy: { medidoEm: "desc" },
        select: { medidoEm: true },
      }),
      tx.eventoOperacional.findFirst({
        where: { cicloId },
        orderBy: { dataHora: "desc" },
        select: { dataHora: true },
      }),
      tx.compraDespesa.findFirst({
        where: { cicloId },
        orderBy: { data: "desc" },
        select: { data: true },
      }),
      tx.venda.findFirst({ where: { cicloId }, select: { id: true } }),
    ]);
    if (existingSale)
      throw new HttpError(409, "O ciclo já possui uma venda registrada.");
    if (
      [measurement?.medidoEm, event?.dataHora, expense?.data].some(
        (when) => when && when > input.dataEncerramento,
      )
    )
      throw new HttpError(
        400,
        "Encerramento anterior a registros existentes do ciclo.",
      );
    const venda = input.venda
      ? await tx.venda.create({
          data: {
            ...input.venda,
            observacao: input.observacao,
            viveiroId,
            cicloId,
            data: input.dataEncerramento,
            criadoPor,
          },
        })
      : null;
    const ciclo = await tx.cicloCultivo.update({
      where: { id: cicloId },
      data: {
        status: "FINALIZADO",
        dataEncerramento: input.dataEncerramento,
        pesoFinal: venda?.pesoTotalKg ?? 0,
        motivoEncerramento: input.motivo,
        observacaoEncerramento: input.justificativa ?? input.observacao,
        quantidadeFinal: input.quantidadeFinal,
      },
      select: cicloPublicoSelect,
    });
    await tx.eventoOperacional.create({
      data: {
        viveiroId,
        cicloId,
        dataHora: input.dataEncerramento,
        tipo: `ENCERRAMENTO_${input.motivo}`,
        descricao:
          input.justificativa ?? input.observacao ?? "Encerramento por venda.",
        criadoPor,
      },
    });
    await tx.viveiro.update({
      where: { id: viveiroId },
      data: { status: "DISPONIVEL" },
    });
    return { ciclo, venda };
  });
}
