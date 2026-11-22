import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import {
  requireAdministrator,
  requireAuthentication,
} from "../auth/middleware";
import type { SessionOptions } from "../auth/session";
import { bodyObject, id } from "../lib/input";
import { HttpError } from "../lib/http-error";
import { pendingReadings, saveRoutine, validateRoutine } from "./service";
export function createRotinasRouter(db: PrismaClient, options: SessionOptions) {
  const router = Router();
  router.use(requireAuthentication(db, options));
  router.get("/", async (_request, response) =>
    response.json({
      rotinas: await db.rotinaMedicao.findMany({
        include: {
          parametro: { select: { nome: true, unidadePadrao: true } },
          viveiro: { select: { identificador: true } },
        },
        orderBy: [{ ativo: "desc" }, { horario: "asc" }, { id: "asc" }],
      }),
    }),
  );
  router.get("/pendencias", async (request, response) =>
    response.json(await pendingReadings(db, request.query)),
  );
  router.post("/", requireAdministrator, async (request, response) =>
    response.status(201).json({
      rotina: await saveRoutine(
        db,
        validateRoutine(request.body),
        request.auth!.usuario.id,
      ),
    }),
  );
  router.put("/:id", requireAdministrator, async (request, response) =>
    response.json({
      rotina: await saveRoutine(
        db,
        validateRoutine(request.body),
        request.auth!.usuario.id,
        id(request.params.id),
      ),
    }),
  );
  router.patch("/:id", requireAdministrator, async (request, response) => {
    const body = bodyObject(request.body, ["ativo"]);
    if (body.ativo !== false)
      throw new HttpError(400, "Use a edição completa para ativar um horário.");
    const changed = await db.rotinaMedicao.updateMany({
      where: { id: id(request.params.id) },
      data: { ativo: false },
    });
    if (!changed.count) throw new HttpError(404, "Horário não encontrado.");
    response.status(204).end();
  });
  return router;
}
