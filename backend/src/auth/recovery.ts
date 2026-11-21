import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../lib/http-error";
import { bodyObject, text } from "../lib/input";
import { hashPassword } from "./password";
import { sendResetEmail, type ResetMessage } from "./mail";
export interface RecoveryOptions {
  send?: (message: ResetMessage) => Promise<void>;
  appUrl?: string;
}
const requests = new Map<string, { count: number; until: number }>();
const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const recoveryResponse = {
  mensagem:
    "Se o endereço estiver cadastrado e ativo, você receberá as instruções de recuperação.",
};
function allowed(key: string, max: number) {
  const now = Date.now();
  if (requests.size > 10000)
    for (const [key, item] of requests)
      if (item.until <= now) requests.delete(key);
  let item = requests.get(key);
  if (!item || item.until <= now) {
    item = { count: 0, until: now + 15 * 60000 };
    requests.set(key, item);
  }
  item.count++;
  return item.count <= max;
}
export async function requestRecovery(
  db: PrismaClient,
  value: unknown,
  ip: string,
  options: RecoveryOptions = {},
) {
  const body = bodyObject(value, ["email"]);
  const email = text(body.email, "E-mail", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, "Informe um e-mail válido.");
  if (
    !allowed(`ip:${tokenHash(ip)}`, 30) ||
    !allowed(`email:${tokenHash(email)}`, 3)
  )
    return;
  const user = await db.usuario.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: "ATIVO" },
    select: { id: true, email: true },
  });
  if (!user) return;
  const token = randomBytes(32).toString("hex");
  const hash = tokenHash(token);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Usuario" WHERE "id" = ${user.id} FOR UPDATE`;
    if (
      !(await tx.usuario.findFirst({
        where: {
          id: user.id,
          status: "ATIVO",
          email: { equals: email, mode: "insensitive" },
        },
        select: { id: true },
      }))
    )
      return;
    await tx.recuperacaoSenha.deleteMany({ where: { usuarioId: user.id } });
    await tx.recuperacaoSenha.create({
      data: {
        tokenHash: hash,
        usuarioId: user.id,
        expiraEm: new Date(Date.now() + 30 * 60000),
      },
    });
  });
  const appUrl = new URL(
    options.appUrl ?? process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:5173",
  );
  if (!["http:", "https:"].includes(appUrl.protocol))
    throw new Error("PUBLIC_APP_URL inválida.");
  const link = new URL("/redefinir-senha", appUrl);
  link.hash = `token=${token}`;
  setImmediate(() => {
    void (options.send ?? sendResetEmail)({
      email: user.email,
      url: link.href,
    }).catch(async () => {
      await db.recuperacaoSenha
        .deleteMany({ where: { tokenHash: hash } })
        .catch(() => undefined);
      console.error(
        "Não foi possível entregar uma mensagem de recuperação. Verifique o serviço SMTP.",
      );
    });
  });
}
export async function completeRecovery(db: PrismaClient, value: unknown) {
  const body = bodyObject(value, ["token", "senha"]);
  if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token))
    throw new HttpError(400, "Link inválido ou expirado.");
  if (
    typeof body.senha !== "string" ||
    body.senha.length < 8 ||
    body.senha.length > 128
  )
    throw new HttpError(400, "Senha deve ter entre 8 e 128 caracteres.");
  const hash = tokenHash(body.token);
  const lookup = await db.recuperacaoSenha.findUnique({
    where: { tokenHash: hash },
    select: { usuarioId: true },
  });
  if (!lookup) throw new HttpError(400, "Link inválido ou expirado.");
  const senha = await hashPassword(body.senha);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Usuario" WHERE "id" = ${lookup.usuarioId} FOR UPDATE`;
    const user = await tx.usuario.findUnique({
      where: { id: lookup.usuarioId },
      select: { status: true },
    });
    if (user?.status !== "ATIVO")
      throw new HttpError(400, "Link inválido ou expirado.");
    const consumed = await tx.recuperacaoSenha.updateMany({
      where: { tokenHash: hash, usadoEm: null, expiraEm: { gt: new Date() } },
      data: { usadoEm: new Date() },
    });
    if (consumed.count !== 1)
      throw new HttpError(400, "Link inválido ou expirado.");
    await tx.usuario.update({
      where: { id: lookup.usuarioId },
      data: { senha },
    });
    await tx.sessaoUsuario.deleteMany({
      where: { usuarioId: lookup.usuarioId },
    });
    await tx.recuperacaoSenha.deleteMany({
      where: { usuarioId: lookup.usuarioId },
    });
  });
}
