import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient, StatusEnvioWhatsApp } from "@prisma/client";
import { Router } from "express";
import { HttpError } from "../lib/http-error";
import { whatsAppOptions, type WhatsAppOptions } from "./provider";
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
function statuses(value: unknown) {
  const rows: Record<string, unknown>[] = [];
  const root = object(value);
  if (!Array.isArray(root?.entry)) return rows;
  for (const entry of root.entry) {
    const changes = object(entry)?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const list = object(object(change)?.value)?.statuses;
      if (Array.isArray(list))
        for (const row of list) {
          const record = object(row);
          if (record) rows.push(record);
        }
    }
  }
  return rows;
}
const rank: Partial<Record<StatusEnvioWhatsApp, number>> = {
  ACEITO: 1,
  ENVIADO: 2,
  ENTREGUE: 3,
  LIDO: 4,
};
export function createWhatsAppWebhook(
  db: PrismaClient,
  options: WhatsAppOptions = whatsAppOptions(),
) {
  const router = Router();
  router.get("/", (request, response) => {
    const token = request.query["hub.verify_token"],
      challenge = request.query["hub.challenge"];
    const expected = options.verifyToken;
    if (
      !expected ||
      typeof token !== "string" ||
      Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(expected)) ||
      request.query["hub.mode"] !== "subscribe" ||
      typeof challenge !== "string" ||
      !/^[A-Za-z0-9_-]{1,1000}$/.test(challenge)
    )
      throw new HttpError(403, "Verificação inválida.");
    response.type("text/plain").send(challenge);
  });
  router.post("/", async (request, response) => {
    if (!options.appSecret)
      throw new HttpError(503, "Webhook não configurado.");
    const raw = request.body as unknown,
      signature = request.header("X-Hub-Signature-256");
    if (
      !Buffer.isBuffer(raw) ||
      !signature ||
      !/^sha256=[a-f0-9]{64}$/.test(signature)
    )
      throw new HttpError(401, "Assinatura inválida.");
    const expected = createHmac("sha256", options.appSecret)
      .update(raw)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex")))
      throw new HttpError(401, "Assinatura inválida.");
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      throw new HttpError(400, "JSON inválido.");
    }
    for (const item of statuses(payload)) {
      if (
        typeof item.id !== "string" ||
        typeof item.status !== "string" ||
        typeof item.timestamp !== "string" ||
        !/^\d+$/.test(item.timestamp)
      )
        continue;
      const mapping: Record<string, StatusEnvioWhatsApp> = {
        sent: "ENVIADO",
        delivered: "ENTREGUE",
        read: "LIDO",
        failed: "FALHA",
      };
      const status = mapping[item.status];
      const when = new Date(Number(item.timestamp) * 1000);
      if (
        !status ||
        !Number.isFinite(when.getTime()) ||
        when.getTime() > Date.now() + 300000
      )
        continue;
      const direct = await db.envioWhatsApp.findUnique({
        where: { mensagemProvedorId: item.id },
        select: { id: true },
      });
      const callbackId =
        typeof item.biz_opaque_callback_data === "string" &&
        /^[1-9]\d*$/.test(item.biz_opaque_callback_data)
          ? Number(item.biz_opaque_callback_data)
          : null;
      const deliveryId =
        direct?.id ??
        (callbackId &&
        Number.isSafeInteger(callbackId) &&
        callbackId <= 2147483647
          ? callbackId
          : null);
      if (!deliveryId) continue;
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "EnvioWhatsApp" WHERE "id" = ${deliveryId} FOR UPDATE`;
        const row = await tx.envioWhatsApp.findUnique({
          where: { id: deliveryId },
        });
        if (
          !row ||
          (typeof item.recipient_id === "string" &&
            row.telefoneDestino !== item.recipient_id) ||
          (row.mensagemProvedorId && row.mensagemProvedorId !== item.id)
        )
          return;
        if (status === "FALHA" && (rank[row.status] ?? 0) >= 3) return;
        if (status !== "FALHA" && (rank[row.status] ?? 0) > (rank[status] ?? 0))
          return;
        await tx.envioWhatsApp.update({
          where: { id: row.id },
          data: {
            status,
            mensagemProvedorId: item.id as string,
            ultimoStatusEm: when,
            erro:
              status === "FALHA"
                ? "O provedor confirmou falha na entrega."
                : null,
          },
        });
      });
    }
    response.status(200).end();
  });
  return router;
}
