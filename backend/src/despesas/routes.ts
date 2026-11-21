import { CategoriaDespesa, Prisma } from "@prisma/client";
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
  id,
  number,
  optionalId,
  optionalText,
  page,
  text,
} from "../lib/input";
import { HttpError } from "../lib/http-error";
import { validateLinks } from "../lib/links";

export function validateExpense(input: unknown) {
  const body = bodyObject(input, [
    "viveiroId",
    "cicloId",
    "data",
    "fornecedorNome",
    "numeroDocumento",
    "formaPagamento",
    "statusPagamento",
    "observacao",
    "itens",
  ]);
  if (!Array.isArray(body.itens) || body.itens.length !== 1)
    throw new HttpError(400, "Informe um item para a despesa.");
  const itens = body.itens.map((value) => {
    const item = bodyObject(value, [
      "categoria",
      "descricao",
      "quantidade",
      "unidade",
      "valorUnit",
      "observacao",
    ]);
    if (
      typeof item.categoria !== "string" ||
      !Object.values(CategoriaDespesa).includes(
        item.categoria as CategoriaDespesa,
      )
    )
      throw new HttpError(400, "Categoria inválida.");
    const quantidade = number(item.quantidade, "Quantidade", 0.001, 1_000_000);
    const valorUnit = number(
      item.valorUnit,
      "Valor unitário",
      0.01,
      10_000_000,
    );
    if (
      new Prisma.Decimal(valorUnit).decimalPlaces() > 2 ||
      new Prisma.Decimal(quantidade).decimalPlaces() > 3
    )
      throw new HttpError(
        400,
        "Use até duas casas no valor e três na quantidade.",
      );
    const valorTotalItem = new Prisma.Decimal(quantidade)
      .mul(valorUnit)
      .toDecimalPlaces(2)
      .toNumber();
    if (valorTotalItem > 1_000_000_000 || valorTotalItem <= 0)
      throw new HttpError(400, "Total do item fora do limite permitido.");
    return {
      categoria: item.categoria as CategoriaDespesa,
      descricao: text(item.descricao, "Descrição", 240),
      quantidade,
      unidade: text(item.unidade, "Unidade", 30),
      valorUnit,
      valorTotalItem,
      observacao: optionalText(item.observacao, "Observação", 1000),
    };
  });
  const statusPagamento = body.statusPagamento ?? "PENDENTE";
  if (statusPagamento !== "PENDENTE" && statusPagamento !== "PAGO")
    throw new HttpError(400, "Situação do pagamento inválida.");
  return {
    viveiroId: optionalId(body.viveiroId),
    cicloId: optionalId(body.cicloId),
    data: date(body.data),
    fornecedorNome: optionalText(body.fornecedorNome, "Fornecedor", 160),
    numeroDocumento: optionalText(body.numeroDocumento, "Documento", 80),
    formaPagamento: optionalText(body.formaPagamento, "Forma de pagamento", 80),
    statusPagamento,
    observacao: optionalText(body.observacao, "Observação", 2000),
    itens,
    valorTotal: itens
      .reduce(
        (sum, item) => sum.add(item.valorTotalItem),
        new Prisma.Decimal(0),
      )
      .toNumber(),
  };
}
export function createDespesasRouter(
  db: PrismaClient,
  options: SessionOptions,
) {
  const router = Router();
  router.use(requireAuthentication(db, options), requireAdministrator);
  router.get("/", async (request, response) => {
    const where = filters(request.query);
    const pagination = page(request.query);
    const [despesas, total, sum] = await db.$transaction([
      db.compraDespesa.findMany({
        where,
        ...pagination,
        include: { itens: true, viveiro: { select: { identificador: true } } },
        orderBy: [{ data: "desc" }, { id: "desc" }],
      }),
      db.compraDespesa.count({ where }),
      db.compraDespesa.aggregate({ where, _sum: { valorTotal: true } }),
    ]);
    response.json({
      despesas,
      total,
      valorTotal: sum._sum.valorTotal ?? 0,
      limite: pagination.take,
      offset: pagination.skip,
    });
  });
  router.get("/:id", async (request, response) => {
    const despesa = await db.compraDespesa.findUnique({
      where: { id: id(request.params.id) },
      include: { itens: true, viveiro: { select: { identificador: true } } },
    });
    if (!despesa) throw new HttpError(404, "Despesa não encontrada.");
    response.json({ despesa });
  });
  router.post("/", async (request, response) => {
    const { itens, ...input } = validateExpense(request.body);
    const despesa = await db.$transaction(async (tx) => {
      const links = await validateLinks(
        tx,
        input.viveiroId,
        input.cicloId,
        input.data,
      );
      return tx.compraDespesa.create({
        data: {
          ...input,
          ...links,
          criadoPor: request.auth!.usuario.id,
          itens: { create: itens },
        },
        include: { itens: true },
      });
    });
    response.status(201).json({ despesa });
  });
  return router;
}
