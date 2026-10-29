import { HttpError } from "../lib/http-error";

const maxInteger = 2_147_483_647;

export function positiveId(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > maxInteger) {
    throw new HttpError(400, `${field} deve ser um inteiro positivo válido.`);
  }
  return value;
}

function timestamp(value: unknown, now: Date): Date {
  if (typeof value !== "string")
    throw new HttpError(400, "Informe a data/hora da medição com fuso horário.");
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (
    !match ||
    value.startsWith("0000-") ||
    Number(match[2]) > 23 ||
    Number(match[3]) > 59 ||
    Number(match[4]) > 59
  ) {
    throw new HttpError(400, "Use uma data/hora válida em ISO 8601, com segundos e fuso horário.");
  }
  const calendar = new Date(`${match[1]}T00:00:00.000Z`);
  const date = new Date(value);
  if (
    !Number.isFinite(calendar.getTime()) ||
    calendar.toISOString().slice(0, 10) !== match[1] ||
    !Number.isFinite(date.getTime())
  ) {
    throw new HttpError(400, "Data/hora da medição inválida.");
  }
  if (date > now) throw new HttpError(400, "A data/hora da medição não pode estar no futuro.");
  return date;
}

export function validateNewMedicao(input: unknown, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new HttpError(400, "Informe um objeto JSON válido.");
  const body = input as Record<string, unknown>;
  const allowed = new Set([
    "cicloId",
    "parametroId",
    "valor",
    "unidade",
    "medidoEm",
    "confirmarAnomalia",
  ]);
  if (Object.keys(body).some((field) => !allowed.has(field)))
    throw new HttpError(400, "A requisição contém campos não permitidos.");
  if (typeof body.valor !== "number" || !Number.isFinite(body.valor))
    throw new HttpError(400, "Valor da medição deve ser um número finito.");
  if (typeof body.unidade !== "string" || !body.unidade.trim() || body.unidade.trim().length > 30)
    throw new HttpError(400, "Informe a unidade do parâmetro.");
  if (body.confirmarAnomalia !== undefined && typeof body.confirmarAnomalia !== "boolean")
    throw new HttpError(400, "A confirmação de anomalia deve ser um booleano.");
  return {
    cicloId: positiveId(body.cicloId, "Ciclo"),
    parametroId: positiveId(body.parametroId, "Parâmetro"),
    valor: body.valor,
    unidade: body.unidade.trim(),
    medidoEm: timestamp(body.medidoEm, now),
    confirmarAnomalia: body.confirmarAnomalia === true,
  };
}

function queryNumber(value: unknown, name: string, minimum: number, maximum: number): number {
  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    Number(value) < minimum ||
    Number(value) > maximum
  ) {
    throw new HttpError(400, `${name} inválido.`);
  }
  return Number(value);
}

export function catalogCycle(query: Record<string, unknown>): number | undefined {
  if (Object.keys(query).some((key) => key !== "cicloId"))
    throw new HttpError(400, "Filtro de parâmetro não permitido.");
  return query.cicloId === undefined
    ? undefined
    : queryNumber(query.cicloId, "Ciclo", 1, maxInteger);
}

export function historyQuery(query: Record<string, unknown>, alerts = false) {
  const allowed = ["cicloId", "parametroId", "limite", "offset", ...(alerts ? ["status"] : [])];
  if (Object.keys(query).some((key) => !allowed.includes(key)))
    throw new HttpError(400, "Filtro não permitido.");
  const status = query.status;
  if (
    status !== undefined &&
    (typeof status !== "string" || !["PENDENTE", "RESOLVIDO", "IGNORADO"].includes(status))
  )
    throw new HttpError(400, "Situação de alerta inválida.");
  return {
    cicloId:
      query.cicloId === undefined ? undefined : queryNumber(query.cicloId, "Ciclo", 1, maxInteger),
    parametroId:
      query.parametroId === undefined
        ? undefined
        : queryNumber(query.parametroId, "Parâmetro", 1, maxInteger),
    limite: query.limite === undefined ? 50 : queryNumber(query.limite, "Limite", 1, 100),
    offset: query.offset === undefined ? 0 : queryNumber(query.offset, "Offset", 0, maxInteger),
    status: status as "PENDENTE" | "RESOLVIDO" | "IGNORADO" | undefined,
  };
}
