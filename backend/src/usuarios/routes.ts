import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import {
  requireAdministrator,
  requireAuthentication,
} from "../auth/middleware";
import { hashPassword } from "../auth/password";
import type { SessionOptions } from "../auth/session";
import { HttpError } from "../lib/http-error";
import { usuarioPublicoSelect } from "./usuario";
import { validateNewUser } from "./validation";
import { editEmployee, resetEmployeePassword } from "./management";
import { id } from "../lib/input";

export function createUsuariosRouter(
  db: PrismaClient,
  options: SessionOptions,
) {
  const router = Router();
  router.use(requireAuthentication(db, options), requireAdministrator);

  router.get("/", async (_request, response) => {
    const usuarios = await db.usuario.findMany({
      where: { perfil: "FUNCIONARIO" },
      select: usuarioPublicoSelect,
      orderBy: [{ nome: "asc" }, { id: "asc" }],
    });
    response.json({ usuarios });
  });

  router.post("/", async (request, response) => {
    const input = validateNewUser(request.body);
    const existing = await db.usuario.findFirst({
      where: { email: { equals: input.email, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing)
      throw new HttpError(409, "Já existe um usuário com esse e-mail.");

    const senha = await hashPassword(input.senha);
    try {
      const usuario = await db.usuario.create({
        data: {
          ...input,
          senha,
          perfil: "FUNCIONARIO",
          status: "ATIVO",
          criadoPor: request.auth!.usuario.id,
        },
        select: usuarioPublicoSelect,
      });
      response.status(201).json({ usuario });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new HttpError(409, "Já existe um usuário com esse e-mail.");
      }
      throw error;
    }
  });

  router.get("/:id", async (request, response) => {
    const usuario = await db.usuario.findFirst({
      where: { id: id(request.params.id), perfil: "FUNCIONARIO" },
      select: usuarioPublicoSelect,
    });
    if (!usuario) throw new HttpError(404, "Funcionário não encontrado.");
    response.json({ usuario });
  });
  router.patch("/:id", async (request, response) =>
    response.json({
      usuario: await editEmployee(db, id(request.params.id), request.body),
    }),
  );
  router.post("/:id/senha", async (request, response) => {
    await resetEmployeePassword(db, id(request.params.id), request.body);
    response.status(204).end();
  });
  return router;
}
