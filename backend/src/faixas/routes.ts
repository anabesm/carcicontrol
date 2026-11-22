import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import {
  requireAdministrator,
  requireAuthentication,
} from "../auth/middleware";
import type { SessionOptions } from "../auth/session";
import { bodyObject, id } from "../lib/input";
import { HttpError } from "../lib/http-error";
import { supportedCodes } from "../medicoes/definitions";
import { saveRange, validateRange } from "./service";
export function createFaixasRouter(db: PrismaClient, options: SessionOptions) {
  const router = Router();
  router.use(requireAuthentication(db, options), requireAdministrator);
  router.get("/parametros", async (_request, response) =>
    response.json({
      parametros: await db.parametro.findMany({
        where: { ativo: true, codigo: { in: supportedCodes } },
        select: {
          id: true,
          codigo: true,
          nome: true,
          unidadePadrao: true,
          minPossivel: true,
          maxPossivel: true,
        },
        orderBy: { nome: "asc" },
      }),
    }),
  );
  router.get("/", async (_request, response) =>
    response.json({
      faixas: await db.faixaParametro.findMany({
        include: {
          parametro: { select: { nome: true, unidadePadrao: true } },
          viveiro: { select: { identificador: true } },
        },
        orderBy: [
          { ativo: "desc" },
          { parametroId: "asc" },
          { diaInicial: "asc" },
          { id: "desc" },
        ],
      }),
    }),
  );
  router.post("/", async (request, response) =>
    response.status(201).json({
      faixa: await saveRange(
        db,
        validateRange(request.body),
        request.auth!.usuario.id,
      ),
    }),
  );
  router.put("/:id", async (request, response) =>
    response.json({
      faixa: await saveRange(
        db,
        validateRange(request.body),
        request.auth!.usuario.id,
        id(request.params.id),
      ),
    }),
  );
  router.patch("/:id", async (request, response) => {
    const body = bodyObject(request.body, ["ativo"]);
    if (body.ativo !== false)
      throw new HttpError(
        400,
        "Use a edição para ativar uma nova versão da faixa.",
      );
    const changed = await db.faixaParametro.updateMany({
      where: { id: id(request.params.id) },
      data: { ativo: false },
    });
    if (!changed.count) throw new HttpError(404, "Faixa não encontrada.");
    response.status(204).end();
  });
  return router;
}
