import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../auth/password";
import { HttpError } from "../lib/http-error";
import { usuarioPublicoSelect } from "../usuarios/usuario";
import type { UsuarioPublico } from "../usuarios/usuario";
import { validateNewUser } from "../usuarios/validation";

export async function seedDemoAdmin(db: PrismaClient, values: unknown) {
  const input = validateNewUser(values);
  const existing = await db.usuario.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
    select: usuarioPublicoSelect,
  });

  function preserved(usuario: UsuarioPublico) {
    if (usuario.perfil !== "ADMINISTRADOR") {
      throw new HttpError(409, "O e-mail informado pertence a um funcionário. O usuário existente foi preservado.");
    }
    return { usuario, created: false };
  }

  if (existing) return preserved(existing);

  const senha = await hashPassword(input.senha);
  try {
    const usuario = await db.usuario.create({
      data: { ...input, senha, perfil: "ADMINISTRADOR", status: "ATIVO" },
      select: usuarioPublicoSelect,
    });
    return { usuario, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const usuario = await db.usuario.findUnique({ where: { email: input.email }, select: usuarioPublicoSelect });
      if (usuario) return preserved(usuario);
    }
    throw error;
  }
}
