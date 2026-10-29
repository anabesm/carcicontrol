import { HttpError } from "../lib/http-error";

const maxInteger = 2_147_483_647;

function objectBody(input: unknown, allowed: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "Informe um objeto JSON válido.");
  }
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((field) => !allowed.includes(field))) {
    throw new HttpError(400, "A requisição contém campos não permitidos.");
  }
  return body;
}

function text(input: unknown, field: string, maximum: number): string {
  if (
    typeof input !== "string" ||
    !input.trim() ||
    input.trim().length > maximum ||
    [...input].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    throw new HttpError(
      400,
      `${field} deve ter entre 1 e ${maximum} caracteres, sem caracteres de controle.`,
    );
  }
  return input.trim();
}

function optionalText(input: unknown, field: string, maximum: number): string | null {
  if (input === undefined || input === null || (typeof input === "string" && !input.trim()))
    return null;
  return text(input, field, maximum);
}

function positiveNumber(input: unknown, field: string): number {
  if (typeof input !== "number" || !Number.isFinite(input) || input <= 0) {
    throw new HttpError(400, `${field} deve ser um número positivo.`);
  }
  return input;
}

function calendarDate(input: unknown, field: string): Date {
  if (
    typeof input !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input) ||
    input.startsWith("0000-")
  ) {
    throw new HttpError(400, `${field} deve ser uma data válida no formato AAAA-MM-DD.`);
  }
  const date = new Date(`${input}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
    throw new HttpError(400, `${field} deve ser uma data válida no formato AAAA-MM-DD.`);
  }
  return date;
}

export function validateViveiroId(input: unknown): number {
  if (typeof input !== "string" || !/^[1-9]\d*$/.test(input) || Number(input) > maxInteger) {
    throw new HttpError(400, "Informe um identificador numérico de viveiro válido.");
  }
  return Number(input);
}

export function validateNewViveiro(input: unknown) {
  const body = objectBody(input, ["identificador", "area", "profundidadeMedia", "localizacao"]);
  return {
    identificador: text(body.identificador, "Identificador", 80),
    area: positiveNumber(body.area, "Área"),
    profundidadeMedia: positiveNumber(body.profundidadeMedia, "Profundidade média"),
    localizacao: optionalText(body.localizacao, "Localização", 240),
  };
}

export function validateNewCycle(input: unknown) {
  const body = objectBody(input, [
    "dataInicio",
    "qtdLarvasInicial",
    "fornecedorLarvas",
    "previsaoDespesca",
  ]);
  const dataInicio = calendarDate(body.dataInicio, "Data de início");
  const qtdLarvasInicial = positiveNumber(body.qtdLarvasInicial, "Quantidade inicial de larvas");
  if (!Number.isInteger(qtdLarvasInicial) || qtdLarvasInicial > maxInteger) {
    throw new HttpError(
      400,
      "Quantidade inicial de larvas deve ser um inteiro entre 1 e 2147483647.",
    );
  }
  const previsaoDespesca =
    body.previsaoDespesca === undefined ||
    body.previsaoDespesca === null ||
    body.previsaoDespesca === ""
      ? null
      : calendarDate(body.previsaoDespesca, "Previsão de despesca");
  if (previsaoDespesca && previsaoDespesca < dataInicio) {
    throw new HttpError(400, "Previsão de despesca não pode ser anterior ao início do ciclo.");
  }
  return {
    dataInicio,
    qtdLarvasInicial,
    fornecedorLarvas: optionalText(body.fornecedorLarvas, "Fornecedor de larvas", 160),
    previsaoDespesca,
  };
}
