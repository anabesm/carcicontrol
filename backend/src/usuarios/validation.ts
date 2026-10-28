import { HttpError } from "../lib/http-error";

function objectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "Informe um objeto JSON válido.");
  }
  return input as Record<string, unknown>;
}

function requiredText(input: unknown, field: string, min: number, max: number): string {
  if (typeof input !== "string" || input.trim().length < min || input.trim().length > max) {
    throw new HttpError(400, `${field} deve ter entre ${min} e ${max} caracteres.`);
  }
  return input.trim();
}

function emailValue(input: unknown): string {
  const email = requiredText(input, "E-mail", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Informe um e-mail válido.");
  }
  return email;
}

function passwordValue(input: unknown, minimum: number): string {
  if (typeof input !== "string" || input.length < minimum || input.length > 128) {
    throw new HttpError(400, `Senha deve ter entre ${minimum} e 128 caracteres.`);
  }
  return input;
}

export function validateLogin(input: unknown) {
  const body = objectBody(input);
  return { email: emailValue(body.email), senha: passwordValue(body.senha, 1) };
}

export function validateNewUser(input: unknown) {
  const body = objectBody(input);
  const allowed = new Set(["nome", "email", "senha", "telefone"]);
  if (Object.keys(body).some((field) => !allowed.has(field))) {
    throw new HttpError(400, "Informe somente nome, e-mail, senha e telefone.");
  }

  let telefone: string | null = null;
  if (body.telefone !== undefined && body.telefone !== null && body.telefone !== "") {
    telefone = requiredText(body.telefone, "Telefone", 3, 30);
  }

  return {
    nome: requiredText(body.nome, "Nome", 2, 120),
    email: emailValue(body.email),
    senha: passwordValue(body.senha, 8),
    telefone,
  };
}
