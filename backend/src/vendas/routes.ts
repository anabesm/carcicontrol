import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import {
  requireAdministrator,
  requireAuthentication,
} from "../auth/middleware";
import type { SessionOptions } from "../auth/session";
import { filters, page } from "../lib/input";

export function createVendasRouter(db: PrismaClient, options: SessionOptions) {
  const router = Router();
  router.use(requireAuthentication(db, options), requireAdministrator);
  router.get("/", async (request, response) => {
    const where = filters(request.query);
    const pagination = page(request.query);
    const [vendas, total] = await db.$transaction([
      db.venda.findMany({
        where,
        ...pagination,
        include: { viveiro: { select: { identificador: true } } },
        orderBy: [{ data: "desc" }, { id: "desc" }],
      }),
      db.venda.count({ where }),
    ]);
    response.json({ vendas, total });
  });
  return router;
}
