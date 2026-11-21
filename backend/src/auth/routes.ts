import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { HttpError } from "../lib/http-error";
import { usuarioPublicoSelect } from "../usuarios/usuario";
import { validateLogin } from "../usuarios/validation";
import { requireAuthentication } from "./middleware";
import { hashPassword, verifyPassword } from "./password";
import { cookieOptions, createSession, sessionCookieName } from "./session";
import type { SessionOptions } from "./session";

export function createAuthRouter(db: PrismaClient, options: SessionOptions) {
  const router = Router();
  const authenticate = requireAuthentication(db, options);
  let dummyHash: Promise<string> | undefined;

  router.post("/login", async (request, response) => {
    const { email, senha } = validateLogin(request.body);
    const found = await db.usuario.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { ...usuarioPublicoSelect, senha: true },
    });

    if (!found) dummyHash ??= hashPassword(randomBytes(32).toString("hex"));
    const valid = await verifyPassword(
      senha,
      found?.senha ?? (await dummyHash!),
    );

    if (!found || !valid || found.status !== "ATIVO") {
      throw new HttpError(401, "E-mail ou senha inválidos.");
    }

    const { senha: _passwordHash, ...usuario } = found;
    const session = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Usuario" WHERE "id" = ${usuario.id} FOR UPDATE`;
      const current = await tx.usuario.findUnique({
        where: { id: usuario.id },
        select: { senha: true, status: true },
      });
      if (
        !current ||
        current.status !== "ATIVO" ||
        current.senha !== found.senha
      )
        throw new HttpError(401, "E-mail ou senha inválidos.");
      return createSession(tx, usuario.id, options.ttlMs);
    });
    response.cookie(sessionCookieName, session.token, {
      ...cookieOptions(options),
      expires: session.expiraEm,
    });
    response.json({ usuario });
  });

  router.get("/me", authenticate, (request, response) => {
    response.json({ usuario: request.auth!.usuario });
  });

  router.post("/logout", authenticate, async (request, response) => {
    await db.sessaoUsuario.deleteMany({
      where: { tokenHash: request.auth!.tokenHash },
    });
    response.clearCookie(sessionCookieName, cookieOptions(options));
    response.status(204).end();
  });

  return router;
}
