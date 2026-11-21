import type { Prisma, PrismaClient } from "@prisma/client";
import { Router } from "express";
import { requireAuthentication } from "../auth/middleware";
import type { SessionOptions } from "../auth/session";
import { id } from "../lib/input";
import { HttpError } from "../lib/http-error";
import { checkedFilters, summary } from "./service";

export function createIndicadoresRouter(
  db: PrismaClient,
  options: SessionOptions,
) {
  const router = Router();
  router.use(requireAuthentication(db, options));
  router.get("/resumo", async (request, response) =>
    response.json(
      await summary(
        db,
        request.query,
        request.auth!.usuario.perfil === "ADMINISTRADOR",
      ),
    ),
  );
  router.get("/evolucao", async (request, response) => {
    const parametroId = id(request.query.parametroId);
    const parameter = await db.parametro.findUnique({
      where: { id: parametroId },
      select: { id: true, nome: true, unidadePadrao: true },
    });
    if (!parameter) throw new HttpError(404, "Parâmetro não encontrado.");
    const { data, ...scope } = await checkedFilters(db, request.query);
    const where: Prisma.MedicaoWhereInput = {
      parametroId,
      ...(scope.cicloId ? { cicloId: scope.cicloId } : {}),
      ...(scope.viveiroId ? { ciclo: { viveiroId: scope.viveiroId } } : {}),
      ...(data ? { medidoEm: data } : {}),
    };
    const medicoes = await db.medicao.findMany({
      where,
      orderBy: [{ medidoEm: "asc" }, { id: "asc" }],
      take: 501,
      select: {
        id: true,
        valor: true,
        unidade: true,
        medidoEm: true,
        minIdealAplicado: true,
        maxIdealAplicado: true,
        cicloId: true,
        ciclo: { select: { viveiro: { select: { identificador: true } } } },
      },
    });
    response.json({
      parametro: parameter,
      medicoes: medicoes.slice(0, 500),
      truncado: medicoes.length > 500,
      limite: 500,
    });
  });
  return router;
}
