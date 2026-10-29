import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { requireAdministrator, requireAuthentication } from "../auth/middleware";
import type { SessionOptions } from "../auth/session";
import { HttpError } from "../lib/http-error";
import { validateNewCycle, validateNewViveiro, validateViveiroId } from "./validation";
import { cicloOrder, cicloPublicoSelect, viveiroPublicoSelect } from "./viveiro";
import { openCycle } from "./service";

export function createViveirosRouter(db: PrismaClient, options: SessionOptions) {
  const router = Router();
  router.use(requireAuthentication(db, options));

  router.get("/", async (_request, response) => {
    const rows = await db.viveiro.findMany({
      select: {
        ...viveiroPublicoSelect,
        ciclos: { where: { status: "ATIVO" }, select: cicloPublicoSelect, take: 1 },
        _count: { select: { ciclos: true } },
      },
      orderBy: [{ identificador: "asc" }, { id: "asc" }],
    });
    const viveiros = rows.map(({ ciclos, _count, ...viveiro }) => ({
      ...viveiro,
      cicloAtivo: ciclos[0] ?? null,
      totalCiclos: _count.ciclos,
    }));
    response.json({ viveiros });
  });

  router.post("/", requireAdministrator, async (request, response) => {
    const input = validateNewViveiro(request.body);
    try {
      const viveiro = await db.viveiro.create({
        data: { ...input, status: "DISPONIVEL" },
        select: viveiroPublicoSelect,
      });
      response.status(201).json({ viveiro: { ...viveiro, cicloAtivo: null, totalCiclos: 0 } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HttpError(409, "Já existe um viveiro com esse identificador.");
      }
      throw error;
    }
  });

  router.get("/:id", async (request, response) => {
    const id = validateViveiroId(request.params.id);
    const viveiro = await db.viveiro.findUnique({
      where: { id },
      select: {
        ...viveiroPublicoSelect,
        ciclos: { select: cicloPublicoSelect, orderBy: cicloOrder },
      },
    });
    if (!viveiro) throw new HttpError(404, "Viveiro não encontrado.");
    response.json({
      viveiro: {
        ...viveiro,
        cicloAtivo: viveiro.ciclos.find((cycle) => cycle.status === "ATIVO") ?? null,
        totalCiclos: viveiro.ciclos.length,
      },
    });
  });

  router.post("/:id/ciclos", requireAdministrator, async (request, response) => {
    const id = validateViveiroId(request.params.id);
    const input = validateNewCycle(request.body);
    const ciclo = await openCycle(db, id, input, request.auth!.usuario.id);
    response.status(201).json({ ciclo });
  });

  return router;
}
