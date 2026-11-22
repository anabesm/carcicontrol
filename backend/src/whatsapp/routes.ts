import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { DateTime } from "luxon";
import {
  requireAdministrator,
  requireAuthentication,
} from "../auth/middleware";
import type { SessionOptions } from "../auth/session";
import { bodyObject, date, id, page } from "../lib/input";
import { HttpError } from "../lib/http-error";
import {
  buildDailySummary,
  getConfig,
  processDeliveries,
  queueDailySummary,
  validateConfig,
  validateContact,
} from "./service";
import {
  providerStatus,
  whatsAppOptions,
  type WhatsAppOptions,
} from "./provider";
export function createWhatsAppRouter(
  db: PrismaClient,
  session: SessionOptions,
  options: WhatsAppOptions = whatsAppOptions(),
) {
  const router = Router();
  router.use(requireAuthentication(db, session), requireAdministrator);
  router.get("/config", async (_request, response) =>
    response.json({
      config: await getConfig(db),
      integracao: providerStatus(options),
    }),
  );
  router.put("/config", async (request, response) => {
    const input = validateConfig(request.body);
    if (
      input.ativo &&
      (!providerStatus(options).configurado || !input.nomeModelo)
    )
      throw new HttpError(
        409,
        "Configure as credenciais da integração e o modelo aprovado antes de ativar.",
      );
    const config = await db.configResumoWhatsApp.upsert({
      where: { id: 1 },
      create: { ...input, atualizadoPor: request.auth!.usuario.id },
      update: { ...input, atualizadoPor: request.auth!.usuario.id },
    });
    response.json({ config });
  });
  router.get("/contatos", async (_request, response) =>
    response.json({
      contatos: await db.contatoWhatsApp.findMany({
        include: { viveiro: { select: { identificador: true } } },
        orderBy: [{ ativo: "desc" }, { nome: "asc" }, { id: "asc" }],
      }),
    }),
  );
  async function saveContact(
    value: unknown,
    userId: number,
    contactId?: number,
  ) {
    const input = validateContact(value);
    try {
      return await db.$transaction(async (tx) => {
        if (
          input.viveiroId &&
          !(await tx.viveiro.findUnique({
            where: { id: input.viveiroId },
            select: { id: true },
          }))
        )
          throw new HttpError(404, "Viveiro não encontrado.");
        if (contactId !== undefined) {
          await tx.$queryRaw`SELECT "id" FROM "ContatoWhatsApp" WHERE "id" = ${contactId} FOR UPDATE`;
          const old = await tx.contatoWhatsApp.findUnique({
            where: { id: contactId },
            include: { _count: { select: { envios: true } } },
          });
          if (!old) throw new HttpError(404, "Contato não encontrado.");
          if (old.telefone !== input.telefone && old._count.envios)
            throw new HttpError(
              409,
              "Este contato possui histórico. Inative-o e cadastre o novo número separadamente.",
            );
          return tx.contatoWhatsApp.update({
            where: { id: contactId },
            data: { ...input, autorizadoEm: new Date() },
          });
        }
        return tx.contatoWhatsApp.create({
          data: { ...input, autorizadoEm: new Date(), criadoPor: userId },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new HttpError(409, "Este número já está cadastrado.");
      throw error;
    }
  }
  router.post("/contatos", async (request, response) =>
    response.status(201).json({
      contato: await saveContact(request.body, request.auth!.usuario.id),
    }),
  );
  router.put("/contatos/:id", async (request, response) =>
    response.json({
      contato: await saveContact(
        request.body,
        request.auth!.usuario.id,
        id(request.params.id),
      ),
    }),
  );
  router.patch("/contatos/:id", async (request, response) => {
    const body = bodyObject(request.body, ["ativo"]);
    if (body.ativo !== false)
      throw new HttpError(400, "Use a edição para reativar um contato.");
    if (
      !(
        await db.contatoWhatsApp.updateMany({
          where: { id: id(request.params.id) },
          data: { ativo: false },
        })
      ).count
    )
      throw new HttpError(404, "Contato não encontrado.");
    response.status(204).end();
  });
  router.get("/previa", async (request, response) => {
    const config = await getConfig(db);
    const day =
      request.query.dia === undefined
        ? DateTime.now().setZone(config.fuso).toISODate()!
        : date(request.query.dia, "Dia", true).toISOString().slice(0, 10);
    response.json(
      await buildDailySummary(
        db,
        day,
        config.fuso,
        request.query.viveiroId === undefined
          ? null
          : id(request.query.viveiroId),
      ),
    );
  });
  router.get("/envios", async (request, response) => {
    const pagination = page(request.query);
    const where = {
      ...(request.query.contatoId === undefined
        ? {}
        : { contatoId: id(request.query.contatoId) }),
      ...(request.query.dia === undefined
        ? {}
        : {
            dia: date(request.query.dia, "Dia", true)
              .toISOString()
              .slice(0, 10),
          }),
    };
    const [envios, total] = await db.$transaction([
      db.envioWhatsApp.findMany({
        where,
        ...pagination,
        include: { contato: { select: { nome: true } } },
        orderBy: { id: "desc" },
      }),
      db.envioWhatsApp.count({ where }),
    ]);
    response.json({
      envios,
      total,
      limite: pagination.take,
      offset: pagination.skip,
    });
  });
  router.post("/enviar", async (request, response) => {
    const body = bodyObject(request.body, ["dia", "confirmar"]);
    if (body.confirmar !== true)
      throw new HttpError(
        400,
        "Confirme explicitamente o envio aos contatos ativos.",
      );
    const config = await getConfig(db),
      day = date(body.dia, "Dia", true).toISOString().slice(0, 10);
    if (day > DateTime.now().setZone(config.fuso).toISODate()!)
      throw new HttpError(
        400,
        "Não é possível enviar resumo de um dia futuro.",
      );
    const result = await queueDailySummary(db, day, options, true);
    await processDeliveries(db, options);
    response.status(202).json(result);
  });
  router.post("/envios/:id/repetir", async (request, response) => {
    const body = bodyObject(request.body, ["confirmar"]);
    if (body.confirmar !== true)
      throw new HttpError(400, "Confirme a repetição do envio que falhou.");
    if (!providerStatus(options).configurado)
      throw new HttpError(409, "Integração não configurada.");
    const changed = await db.envioWhatsApp.updateMany({
      where: {
        id: id(request.params.id),
        status: "FALHA",
        mensagemProvedorId: null,
      },
      data: { status: "PENDENTE", origem: "MANUAL", erro: null },
    });
    if (!changed.count)
      throw new HttpError(
        409,
        "Somente falhas confirmadas sem mensagem aceita podem ser repetidas.",
      );
    await processDeliveries(db, options);
    response.status(202).json({
      mensagem: "Repetição processada. Consulte o resultado do envio.",
    });
  });
  return router;
}
