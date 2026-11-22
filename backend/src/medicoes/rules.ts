import { HttpError } from "../lib/http-error";
import type { FaixaConfig, ParametroConfig } from "./selects";
import { DateTime } from "luxon";

export function cycleDay(start: Date, at: Date) {
  const beginning = DateTime.fromISO(start.toISOString().slice(0, 10), {
    zone: "America/Sao_Paulo",
  }).startOf("day");
  return Math.max(
    0,
    Math.floor(
      DateTime.fromJSDate(at, { zone: "America/Sao_Paulo" })
        .startOf("day")
        .diff(beginning, "days").days,
    ),
  );
}

export function resolveFaixa(
  parameter: ParametroConfig,
  viveiroId?: number,
  day?: number,
): FaixaConfig {
  const applicable = parameter.faixas.filter(
    (range) =>
      !range.faseNome ||
      (day !== undefined &&
        day >= range.diaInicial &&
        (range.diaFinal === null || day <= range.diaFinal)),
  );
  const specific = applicable.filter(
    (range) => viveiroId !== undefined && range.viveiroId === viveiroId,
  );
  const scoped = specific.length
    ? specific
    : applicable.filter((range) => range.viveiroId === null);
  const phases = scoped.filter((range) => Boolean(range.faseNome));
  const candidates = phases.length
    ? phases
    : scoped.filter((range) => !range.faseNome);
  if (candidates.length !== 1)
    throw new HttpError(
      503,
      `É necessário configurar uma única faixa ativa para ${parameter.nome}.`,
    );
  const range = candidates[0]!;
  const min = parameter.minPossivel;
  const max = parameter.maxPossivel;
  if (
    min === null ||
    max === null ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min >= max ||
    !Number.isFinite(range.minIdeal) ||
    !Number.isFinite(range.maxIdeal) ||
    range.minIdeal > range.maxIdeal ||
    range.minIdeal < min ||
    range.maxIdeal > max ||
    (range.minCritico !== null &&
      (!Number.isFinite(range.minCritico) ||
        range.minCritico < min ||
        range.minCritico > range.minIdeal)) ||
    (range.maxCritico !== null &&
      (!Number.isFinite(range.maxCritico) ||
        range.maxCritico > max ||
        range.maxCritico < range.maxIdeal))
  ) {
    throw new HttpError(
      503,
      `Os limites de ${parameter.nome} precisam ser revisados.`,
    );
  }
  return range;
}

export function assessValue(
  parameter: ParametroConfig,
  range: FaixaConfig,
  value: number,
) {
  if (
    !Number.isFinite(value) ||
    value < parameter.minPossivel! ||
    value > parameter.maxPossivel!
  ) {
    throw new HttpError(
      400,
      `Valor fora dos limites aceitos para ${parameter.nome}: ${parameter.minPossivel} a ${parameter.maxPossivel} ${parameter.unidadePadrao}.`,
    );
  }
  const direction =
    value < range.minIdeal ? "ABAIXO" : value > range.maxIdeal ? "ACIMA" : null;
  const critical =
    direction === "ABAIXO"
      ? range.minCritico !== null && value < range.minCritico
      : direction === "ACIMA" &&
        range.maxCritico !== null &&
        value > range.maxCritico;
  return {
    direction,
    gravidade: critical ? ("ALTA" as const) : ("MEDIA" as const),
    limiteViolado:
      direction === "ABAIXO"
        ? `Abaixo do mínimo ideal de ${range.minIdeal} ${parameter.unidadePadrao}`
        : `Acima do máximo ideal de ${range.maxIdeal} ${parameter.unidadePadrao}`,
  };
}
