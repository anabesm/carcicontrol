import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { HttpError } from "../lib/http-error";
import { bodyObject, optionalText, text } from "../lib/input";
import { hashPassword } from "../auth/password";
import { usuarioPublicoSelect } from "./usuario";

export function validateUserEdit(value: unknown) {
  const body = bodyObject(value, ["nome", "email", "telefone", "status"]);
  if (!Object.keys(body).length)
    throw new HttpError(400, "Informe os dados a atualizar.");
  const data: {
    nome?: string;
    email?: string;
    telefone?: string | null;
    status?: "ATIVO" | "INATIVO";
  } = {};
  if (body.nome !== undefined) {
    data.nome = text(body.nome, "Nome", 120);
    if (data.nome.length < 2)
      throw new HttpError(400, "Nome deve ter ao menos dois caracteres.");
  }
  if (body.email !== undefined) {
    data.email = text(body.email, "E-mail", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      throw new HttpError(400, "Informe um e-mail válido.");
  }
  if (body.telefone !== undefined)
    data.telefone = optionalText(body.telefone, "Telefone", 30);
  if (body.status !== undefined) {
    if (body.status !== "ATIVO" && body.status !== "INATIVO")
      throw new HttpError(400, "Situação inválida.");
    data.status = body.status;
  }
  return data;
}
export async function editEmployee(
  db: PrismaClient,
  id: number,
  value: unknown,
) {
  const data = validateUserEdit(value);
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Usuario" WHERE "id" = ${id} FOR UPDATE`;
      const existing = await tx.usuario.findFirst({
        where: { id, perfil: "FUNCIONARIO" },
        select: { id: true, email: true },
      });
      if (!existing) throw new HttpError(404, "Funcionário não encontrado.");
      if (
        data.email &&
        (await tx.usuario.findFirst({
          where: {
            id: { not: id },
            email: { equals: data.email, mode: "insensitive" },
          },
          select: { id: true },
        }))
      )
        throw new HttpError(409, "Já existe um usuário com esse e-mail.");
      const usuario = await tx.usuario.update({
        where: { id },
        data,
        select: usuarioPublicoSelect,
      });
      if (
        data.status !== undefined ||
        (data.email !== undefined && data.email !== existing.email)
      ) {
        await tx.sessaoUsuario.deleteMany({ where: { usuarioId: id } });
        await tx.recuperacaoSenha.deleteMany({ where: { usuarioId: id } });
      }
      return usuario;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new HttpError(409, "Já existe um usuário com esse e-mail.");
    throw error;
  }
}
export async function resetEmployeePassword(
  db: PrismaClient,
  id: number,
  value: unknown,
) {
  const body = bodyObject(value, ["senha"]);
  if (
    typeof body.senha !== "string" ||
    body.senha.length < 8 ||
    body.senha.length > 128
  )
    throw new HttpError(400, "Senha deve ter entre 8 e 128 caracteres.");
  const senha = await hashPassword(body.senha);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Usuario" WHERE "id" = ${id} FOR UPDATE`;
    const existing = await tx.usuario.findFirst({
      where: { id, perfil: "FUNCIONARIO" },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, "Funcionário não encontrado.");
    await tx.usuario.update({ where: { id }, data: { senha } });
    await tx.sessaoUsuario.deleteMany({ where: { usuarioId: id } });
    await tx.recuperacaoSenha.deleteMany({ where: { usuarioId: id } });
  });
}
