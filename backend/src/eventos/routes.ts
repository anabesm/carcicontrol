import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import {
  requireAdministrator,
  requireAuthentication,
} from "../auth/middleware";
import type { SessionOptions } from "../auth/session";
import {
  bodyObject,
  date,
  filters,
  number,
  optionalId,
  page,
  text,
} from "../lib/input";
import { validateLinks } from "../lib/links";
import { HttpError } from "../lib/http-error";

export function createEventosRouter(db: PrismaClient, options: SessionOptions) {
  const router = Router();
  router.use(requireAuthentication(db, options));
  router.get("/", async (request, response) => {
    const filter = filters(request.query);
    const { data, ...links } = filter;
    const where = { ...links, ...(data ? { dataHora: data } : {}) };
    const pagination = page(request.query);
    const [rows, total] = await db.$transaction([
      db.eventoOperacional.findMany({
        where,
        ...pagination,
        include: { viveiro: { select: { identificador: true } } },
        orderBy: [{ dataHora: "desc" }, { id: "desc" }],
      }),
      db.eventoOperacional.count({ where }),
    ]);
    const users = await db.usuario.findMany({
      where: { id: { in: rows.map((row) => row.criadoPor) } },
      select: { id: true, nome: true },
    });
    response.json({
      eventos: rows.map((row) => ({
        ...row,
        responsavel: users.find((user) => user.id === row.criadoPor) ?? null,
      })),
      total,
      limite: pagination.take,
      offset: pagination.skip,
    });
  });
  router.post("/", requireAdministrator, async (request, response) => {
    const body = bodyObject(request.body, [
      "viveiroId",
      "cicloId",
      "dataHora",
      "tipo",
      "descricao",
      "quantidade",
    ]);
    const viveiroId = optionalId(body.viveiroId);
    if (!viveiroId) throw new HttpError(400, "Informe o viveiro.");
    const cicloId = optionalId(body.cicloId);
    const dataHora = date(body.dataHora, "Data/hora");
    const tipo = text(body.tipo, "Tipo", 80);
    if (tipo.startsWith("ENCERRAMENTO_"))
      throw new HttpError(400, "Use a operação de encerramento do ciclo.");
    const descricao = text(body.descricao, "Descrição", 2000);
    const quantidade =
      body.quantidade == null ? null : number(body.quantidade, "Quantidade", 0);
    const evento = await db.$transaction(async (tx) => {
      const links = await validateLinks(tx, viveiroId, cicloId, dataHora);
      return tx.eventoOperacional.create({
        data: {
          ...links,
          viveiroId,
          dataHora,
          tipo,
          descricao,
          quantidade,
          criadoPor: request.auth!.usuario.id,
        },
      });
    });
    response.status(201).json({ evento });
  });
  return router;
}
