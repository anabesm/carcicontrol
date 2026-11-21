import { HttpError } from "./http-error";

export function bodyObject(value: unknown, allowed: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Informe um objeto JSON válido.");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw new HttpError(400, "A requisição contém campos não permitidos.");
  return body;
}
export function text(value: unknown, label: string, max = 240) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    throw new HttpError(400, `${label}: informe de 1 a ${max} caracteres.`);
  return value.trim();
}
export function optionalText(
  value: unknown,
  label: string,
  max = 240,
): string | null {
  return value === undefined || value === null || value === ""
    ? null
    : text(value, label, max);
}
export function number(
  value: unknown,
  label: string,
  min = 0,
  max = 1_000_000_000,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new HttpError(
      400,
      `${label}: informe um número entre ${min} e ${max}.`,
    );
  return value;
}
export function integer(
  value: unknown,
  label: string,
  min = 1,
  max = 2_147_483_647,
) {
  const result = number(value, label, min, max);
  if (!Number.isInteger(result))
    throw new HttpError(400, `${label}: informe um número inteiro.`);
  return result;
}
export function id(value: unknown) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value))
    throw new HttpError(400, "Identificador inválido.");
  return integer(Number(value), "Identificador");
}
export function optionalId(value: unknown): number | null {
  return value === undefined || value === null || value === ""
    ? null
    : integer(value, "Identificador");
}
export function date(value: unknown, label = "Data", future = false) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    )
  )
    throw new HttpError(
      400,
      `${label}: use uma data válida ou data/hora com fuso.`,
    );
  const result = new Date(
    value.length === 10 ? `${value}T00:00:00.000Z` : value,
  );
  if (
    !Number.isFinite(result.getTime()) ||
    value.startsWith("0000") ||
    (value.length === 10 && result.toISOString().slice(0, 10) !== value)
  )
    throw new HttpError(400, `${label} inválida.`);
  if (!future && result.getTime() > Date.now())
    throw new HttpError(400, `${label} não pode estar no futuro.`);
  return result;
}
export function page(query: Record<string, unknown>) {
  const parse = (v: unknown, fallback: number, min: number, max: number) =>
    v === undefined
      ? fallback
      : typeof v === "string" && /^\d+$/.test(v)
        ? integer(Number(v), "Paginação", min, max)
        : (() => {
            throw new HttpError(400, "Paginação inválida.");
          })();
  return {
    take: parse(query.limite, 50, 1, 100),
    skip: parse(query.offset, 0, 0, 1_000_000),
  };
}
export function filters(query: Record<string, unknown>) {
  const inicio =
    query.inicio === undefined ? undefined : date(query.inicio, "Início", true);
  let fim = query.fim === undefined ? undefined : date(query.fim, "Fim", true);
  if (fim && typeof query.fim === "string" && query.fim.length === 10)
    fim = new Date(fim.getTime() + 86_400_000 - 1);
  if (inicio && fim && inicio > fim)
    throw new HttpError(400, "O início não pode ser posterior ao fim.");
  return {
    ...(query.viveiroId === undefined
      ? {}
      : { viveiroId: id(query.viveiroId) }),
    ...(query.cicloId === undefined ? {} : { cicloId: id(query.cicloId) }),
    ...(inicio || fim
      ? {
          data: {
            ...(inicio ? { gte: inicio } : {}),
            ...(fim ? { lte: fim } : {}),
          },
        }
      : {}),
  };
}
export const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
