import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { CookieOptions, Request } from "express";
import type { UsuarioPublico } from "../usuarios/usuario";

export const sessionCookieName = "carcicontrol_session";

export interface SessionOptions {
  ttlMs: number;
  secure: boolean;
}

export interface AuthenticatedSession {
  tokenHash: string;
  usuario: UsuarioPublico;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function cookieOptions(options: SessionOptions): CookieOptions {
  return { httpOnly: true, secure: options.secure, sameSite: "lax", path: "/" };
}

export function readSessionToken(request: Request): string | undefined {
  const prefix = `${sessionCookieName}=`;
  const cookies = request.headers.cookie?.split(";").map((item) => item.trim())
    .filter((item) => item.startsWith(prefix)) ?? [];
  if (cookies.length !== 1) return undefined;
  const token = cookies[0]?.slice(prefix.length);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

export async function createSession(db: PrismaClient, usuarioId: number, ttlMs: number) {
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + ttlMs);
  await db.sessaoUsuario.create({
    data: { tokenHash: hashSessionToken(token), usuarioId, expiraEm },
  });
  return { token, expiraEm };
}
