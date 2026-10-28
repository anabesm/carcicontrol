import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import { HttpError } from "../lib/http-error";
import { usuarioPublicoSelect } from "../usuarios/usuario";
import { cookieOptions, hashSessionToken, readSessionToken, sessionCookieName } from "./session";
import type { SessionOptions } from "./session";

export function requireAuthentication(db: PrismaClient, options: SessionOptions): RequestHandler {
  return async (request, response, next) => {
    const token = readSessionToken(request);
    const session = token ? await db.sessaoUsuario.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { usuario: { select: usuarioPublicoSelect } },
    }) : null;

    if (!session || session.expiraEm.getTime() <= Date.now() || session.usuario.status !== "ATIVO") {
      if (session) await db.sessaoUsuario.deleteMany({ where: { tokenHash: session.tokenHash } });
      response.clearCookie(sessionCookieName, cookieOptions(options));
      throw new HttpError(401, "Autenticação necessária ou sessão expirada.");
    }

    request.auth = { tokenHash: session.tokenHash, usuario: session.usuario };
    next();
  };
}

export const requireAdministrator: RequestHandler = (request, _response, next) => {
  if (request.auth?.usuario.perfil !== "ADMINISTRADOR") {
    throw new HttpError(403, "Acesso permitido somente ao administrador.");
  }
  next();
};
