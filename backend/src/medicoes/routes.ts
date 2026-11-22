import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import {
  requireAdministrator,
  requireAuthentication,
} from "../auth/middleware";
import type { SessionOptions } from "../auth/session";
import {
  listAlertas,
  listMedicoes,
  listParameters,
  recordMedicao,
} from "./service";
import { catalogCycle, historyQuery, validateNewMedicao } from "./validation";
import { bodyObject, date, id, text } from "../lib/input";
import { HttpError } from "../lib/http-error";
import { alertaBaseSelect } from "./selects";
import { supportedCodes } from "./definitions";

export function createMedicoesRouter(
  db: PrismaClient,
  options: SessionOptions,
) {
  const router = Router();
  router.use(
    ["/parametros", "/medicoes", "/alertas"],
    requireAuthentication(db, options),
  );
  router.get("/parametros/catalogo", async (_request, response) =>
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
  router.get("/parametros", async (request, response) => {
    response.json({
      parametros: await listParameters(
        db,
        catalogCycle(request.query),
        request.query.medidoEm === undefined
          ? undefined
          : date(request.query.medidoEm, "Data da medição"),
      ),
    });
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
  router.patch(
    "/alertas/:id",
    requireAdministrator,
    async (request, response) => {
      const alertId = id(request.params.id);
      const body = bodyObject(request.body, ["status", "observacao"]);
      if (body.status !== "RESOLVIDO" && body.status !== "IGNORADO")
        throw new HttpError(400, "Selecione resolvido ou ignorado.");
      const observacaoResolucao = text(body.observacao, "Justificativa", 2000);
      const alerta = await db.$transaction(async (tx) => {
        const changed = await tx.alerta.updateMany({
          where: { id: alertId, status: "PENDENTE" },
          data: {
            status: body.status as "RESOLVIDO" | "IGNORADO",
            observacaoResolucao,
            resolvidoPorId: request.auth!.usuario.id,
            resolvidoEm: new Date(),
          },
        });
        if (changed.count !== 1) {
          if (
            !(await tx.alerta.findUnique({
              where: { id: alertId },
              select: { id: true },
            }))
          )
            throw new HttpError(404, "Alerta não encontrado.");
          throw new HttpError(
            409,
            "Este alerta já foi tratado. Atualize o histórico.",
          );
        }
        return tx.alerta.findUniqueOrThrow({
          where: { id: alertId },
          select: alertaBaseSelect,
        });
      });
      response.json({ alerta });
    },
  );
  return router;
}
