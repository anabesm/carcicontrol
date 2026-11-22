import type { PrismaClient } from "@prisma/client";
import { DateTime, IANAZone } from "luxon";
import { HttpError } from "../lib/http-error";
import { bodyObject, date, id, integer, optionalId, text } from "../lib/input";

export function validateRoutine(value: unknown) {
  const body = bodyObject(value, [
    "parametroId",
    "viveiroId",
    "horario",
    "fuso",
    "toleranciaMinutos",
  ]);
  const horario = text(body.horario, "Horário", 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario))
    throw new HttpError(400, "Use horário entre 00:00 e 23:59.");
  const fuso =
    body.fuso === undefined ? "America/Sao_Paulo" : text(body.fuso, "Fuso", 80);
  if (!IANAZone.isValidZone(fuso))
    throw new HttpError(400, "Informe um fuso IANA válido.");
  return {
    parametroId: integer(body.parametroId, "Parâmetro"),
    viveiroId: optionalId(body.viveiroId),
    horario,
    fuso,
    toleranciaMinutos:
      body.toleranciaMinutos === undefined
        ? 60
        : integer(body.toleranciaMinutos, "Tolerância em minutos", 1, 180),
  };
}
const minuteOfDay = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
export async function saveRoutine(
  db: PrismaClient,
  input: ReturnType<typeof validateRoutine>,
  userId: number,
  id?: number,
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(9172620)`;
    if (
      id !== undefined &&
      !(await tx.rotinaMedicao.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new HttpError(404, "Horário não encontrado.");
    if (
      !(await tx.parametro.findFirst({
        where: { id: input.parametroId, ativo: true },
        select: { id: true },
      }))
    )
      throw new HttpError(404, "Parâmetro ativo não encontrado.");
    if (
      input.viveiroId &&
      !(await tx.viveiro.findUnique({
        where: { id: input.viveiroId },
        select: { id: true },
      }))
    )
      throw new HttpError(404, "Viveiro não encontrado.");
    const existing = await tx.rotinaMedicao.findMany({
      where: {
        parametroId: input.parametroId,
        viveiroId: input.viveiroId,
        ativo: true,
        ...(id ? { id: { not: id } } : {}),
      },
    });
    for (const item of existing) {
      const distance = Math.abs(
        minuteOfDay(item.horario) - minuteOfDay(input.horario),
      );
      if (item.fuso !== input.fuso)
        throw new HttpError(
          400,
          "Use o mesmo fuso nos horários do mesmo parâmetro e viveiro.",
        );
      if (
        Math.min(distance, 1440 - distance) <=
        item.toleranciaMinutos + input.toleranciaMinutos
      )
        throw new HttpError(
          409,
          "A janela deste horário se sobrepõe a outro horário ativo.",
        );
    }
    return id === undefined
      ? tx.rotinaMedicao.create({ data: { ...input, criadoPor: userId } })
      : tx.rotinaMedicao.update({
          where: { id },
          data: { ...input, ativo: true },
        });
  });
}
export async function pendingReadings(
  db: PrismaClient,
  query: Record<string, unknown>,
  now = new Date(),
) {
  const day =
    query.data === undefined
      ? DateTime.fromJSDate(now, { zone: "America/Sao_Paulo" }).toISODate()!
      : date(query.data, "Dia", true).toISOString().slice(0, 10);
  const viveiroId =
    query.viveiroId === undefined ? undefined : id(query.viveiroId);
  const cicloId = query.cicloId === undefined ? undefined : id(query.cicloId);
  const cycles = await db.cicloCultivo.findMany({
    where: {
      status: "ATIVO",
      ...(viveiroId ? { viveiroId } : {}),
      ...(cicloId ? { id: cicloId } : {}),
    },
    include: { viveiro: { select: { identificador: true } } },
  });
  const schedules = await db.rotinaMedicao.findMany({
    where: {
      ativo: true,
      parametro: { ativo: true },
      OR: [
        { viveiroId: null },
        { viveiroId: { in: cycles.map((cycle) => cycle.viveiroId) } },
      ],
    },
    include: {
      parametro: { select: { id: true, nome: true, unidadePadrao: true } },
    },
    orderBy: [{ horario: "asc" }, { id: "asc" }],
  });
  const slots = cycles.flatMap((cycle) => {
    const configured = schedules.filter(
      (schedule) =>
        schedule.viveiroId === null || schedule.viveiroId === cycle.viveiroId,
    );
    return configured
      .filter(
        (schedule) =>
          schedule.viveiroId !== null ||
          !configured.some(
            (other) =>
              other.viveiroId === cycle.viveiroId &&
              other.parametroId === schedule.parametroId,
          ),
      )
      .flatMap((schedule) => {
        const time = DateTime.fromISO(`${day}T${schedule.horario}`, {
          zone: schedule.fuso,
        });
        if (
          !time.isValid ||
          time.toFormat("HH:mm") !== schedule.horario ||
          time.toJSDate() < cycle.dataInicio
        )
          return [];
        return [
          {
            cicloId: cycle.id,
            viveiroId: cycle.viveiroId,
            viveiro: cycle.viveiro.identificador,
            rotinaId: schedule.id,
            parametro: schedule.parametro,
            esperadoEm: time.toJSDate(),
            inicioJanela: time
              .minus({ minutes: schedule.toleranciaMinutos })
              .toJSDate(),
            fimJanela: time
              .plus({ minutes: schedule.toleranciaMinutos })
              .toJSDate(),
            fuso: schedule.fuso,
            horario: schedule.horario,
          },
        ];
      });
  });
  if (!slots.length) return { data: day, pendencias: [], total: 0 };
  const readings = await db.medicao.findMany({
    where: {
      cicloId: { in: cycles.map((cycle) => cycle.id) },
      medidoEm: {
        gte: new Date(
          Math.min(...slots.map((slot) => slot.inicioJanela.getTime())),
        ),
        lte: new Date(
          Math.min(
            now.getTime(),
            Math.max(...slots.map((slot) => slot.fimJanela.getTime())),
          ),
        ),
      },
    },
    select: {
      id: true,
      cicloId: true,
      parametroId: true,
      medidoEm: true,
      valor: true,
      unidade: true,
    },
    orderBy: [{ medidoEm: "asc" }, { id: "asc" }],
  });
  const used = new Set<number>();
  const pendencias = slots
    .sort(
      (a, b) =>
        a.esperadoEm.getTime() - b.esperadoEm.getTime() ||
        a.cicloId - b.cicloId,
    )
    .map((slot) => {
      const reading = readings.find(
        (row) =>
          !used.has(row.id) &&
          row.cicloId === slot.cicloId &&
          row.parametroId === slot.parametro.id &&
          row.medidoEm >= slot.inicioJanela &&
          row.medidoEm <= slot.fimJanela,
      );
      if (reading) used.add(reading.id);
      return {
        ...slot,
        situacao: reading
          ? "CONCLUIDA"
          : now > slot.fimJanela
            ? "PENDENTE"
            : "AGUARDANDO",
        medicao: reading ?? null,
      };
    });
  return {
    data: day,
    pendencias,
    total: pendencias.filter((row) => row.situacao === "PENDENTE").length,
  };
}
