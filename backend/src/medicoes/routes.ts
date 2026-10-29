import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { requireAuthentication } from "../auth/middleware";
import type { SessionOptions } from "../auth/session";
import { listAlertas, listMedicoes, listParameters, recordMedicao } from "./service";
import { catalogCycle, historyQuery, validateNewMedicao } from "./validation";

export function createMedicoesRouter(db: PrismaClient, options: SessionOptions) {
  const router = Router();
  router.use(["/parametros", "/medicoes", "/alertas"], requireAuthentication(db, options));
  router.get("/parametros", async (request, response) => {
    response.json({ parametros: await listParameters(db, catalogCycle(request.query)) });
  });
  router.get("/medicoes", async (request, response) => {
    response.json(await listMedicoes(db, historyQuery(request.query)));
  });
  router.post("/medicoes", async (request, response) => {
    const input = validateNewMedicao(request.body);
    const medicao = await recordMedicao(db, input, request.auth!.usuario.id);
    response.status(201).json({ medicao });
  });
  router.get("/alertas", async (request, response) => {
    response.json(await listAlertas(db, historyQuery(request.query, true)));
  });
  return router;
}
