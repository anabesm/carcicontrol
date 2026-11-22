import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import {
  requireAdministrator,
  requireAuthentication,
} from "../auth/middleware";
import type { SessionOptions } from "../auth/session";
import { managementReport } from "./service";
export function createRelatoriosRouter(
  db: PrismaClient,
  options: SessionOptions,
) {
  const router = Router();
  router.use(requireAuthentication(db, options), requireAdministrator);
  router.get("/", async (request, response) =>
    response.json(await managementReport(db, request.query)),
  );
  router.get("/csv", async (request, response) => {
    const report = await managementReport(db, request.query);
    const escape = (value: unknown) => {
      let text = value == null ? "" : String(value);
      if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text))
        text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows: unknown[][] = [
      [
        "Viveiro",
        "Ciclo",
        "Situação",
        "Peso final (kg)",
        "Sobrevivência (%)",
        "Produtividade (kg/ha)",
        "Despesas registradas (R$)",
        "Receita (R$)",
        "Saldo registrado (R$)",
        "Custo registrado/kg (R$)",
      ],
    ];
    for (const row of report.ciclos)
      rows.push([
        row.viveiro,
        row.id,
        row.status,
        row.pesoFinalKg,
        row.sobrevivenciaPercentual,
        row.produtividadeKgHa,
        row.despesasRegistradas,
        row.receitaRegistrada,
        row.saldoRegistrado,
        row.custoRegistradoPorKg,
      ]);
    response
      .type("text/csv")
      .set(
        "Content-Disposition",
        'attachment; filename="carcicontrol-relatorio.csv"',
      )
      .send(
        "\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\r\n"),
      );
  });
  return router;
}
