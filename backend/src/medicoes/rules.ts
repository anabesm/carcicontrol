import { HttpError } from "../lib/http-error";
import type { FaixaConfig, ParametroConfig } from "./selects";

export function resolveFaixa(parameter: ParametroConfig, viveiroId?: number): FaixaConfig {
  const specific = parameter.faixas.filter(
    (range) => viveiroId !== undefined && range.viveiroId === viveiroId,
  );
  const candidates = specific.length
    ? specific
    : parameter.faixas.filter((range) => range.viveiroId === null);
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
    throw new HttpError(503, `Os limites de ${parameter.nome} precisam ser revisados.`);
  }
  return range;
}

export function assessValue(parameter: ParametroConfig, range: FaixaConfig, value: number) {
  if (!Number.isFinite(value) || value < parameter.minPossivel! || value > parameter.maxPossivel!) {
    throw new HttpError(
      400,
      `Valor fora dos limites aceitos para ${parameter.nome}: ${parameter.minPossivel} a ${parameter.maxPossivel} ${parameter.unidadePadrao}.`,
    );
  }
  const direction = value < range.minIdeal ? "ABAIXO" : value > range.maxIdeal ? "ACIMA" : null;
  const critical =
    direction === "ABAIXO"
      ? range.minCritico !== null && value < range.minCritico
      : direction === "ACIMA" && range.maxCritico !== null && value > range.maxCritico;
  return {
    direction,
    gravidade: critical ? ("ALTA" as const) : ("MEDIA" as const),
    limiteViolado:
      direction === "ABAIXO"
        ? `Abaixo do mínimo ideal de ${range.minIdeal} ${parameter.unidadePadrao}`
        : `Acima do máximo ideal de ${range.maxIdeal} ${parameter.unidadePadrao}`,
  };
}
