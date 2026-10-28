import type { Prisma } from "@prisma/client";

export const usuarioPublicoSelect = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  perfil: true,
  status: true,
  criadoEm: true,
} satisfies Prisma.UsuarioSelect;

export type UsuarioPublico = Prisma.UsuarioGetPayload<{ select: typeof usuarioPublicoSelect }>;
