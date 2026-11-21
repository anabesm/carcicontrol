import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../lib/http-error";
import { bodyObject, number, optionalText, text } from "../lib/input";
import { viveiroPublicoSelect } from "./viveiro";
export async function editPond(db: PrismaClient, id: number, value: unknown) {
  const body = bodyObject(value, [
    "identificador",
    "area",
    "profundidadeMedia",
    "localizacao",
    "status",
  ]);
  if (!Object.keys(body).length)
    throw new HttpError(400, "Informe os dados a atualizar.");
  const data: {
    identificador?: string;
    area?: number;
    profundidadeMedia?: number;
    localizacao?: string | null;
    status?: "DISPONIVEL" | "MANUTENCAO" | "INATIVO";
  } = {};
  if (body.identificador !== undefined)
    data.identificador = text(body.identificador, "Identificador", 80);
  if (body.area !== undefined) data.area = number(body.area, "Área", 0.000001);
  if (body.profundidadeMedia !== undefined)
    data.profundidadeMedia = number(
      body.profundidadeMedia,
      "Profundidade média",
      0.000001,
    );
  if (body.localizacao !== undefined)
    data.localizacao = optionalText(body.localizacao, "Localização", 240);
  if (body.status !== undefined) {
    if (
      body.status !== "DISPONIVEL" &&
      body.status !== "MANUTENCAO" &&
      body.status !== "INATIVO"
    )
      throw new HttpError(
        400,
        "Situação inválida. Ocupação é controlada pelo ciclo.",
      );
    data.status = body.status;
  }
  try {
    return await db.$transaction(async (tx) => {
      const ponds = await tx.$queryRaw<
        Array<{ id: number }>
      >`SELECT "id" FROM "Viveiro" WHERE "id" = ${id} FOR UPDATE`;
      if (!ponds[0]) throw new HttpError(404, "Viveiro não encontrado.");
      if (
        data.status &&
        (await tx.cicloCultivo.findFirst({
          where: { viveiroId: id, status: "ATIVO" },
          select: { id: true },
        }))
      )
        throw new HttpError(
          409,
          "Encerre o ciclo ativo antes de alterar a situação do viveiro.",
        );
      return tx.viveiro.update({
        where: { id },
        data,
        select: viveiroPublicoSelect,
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new HttpError(409, "Já existe um viveiro com esse identificador.");
    throw error;
  }
}
