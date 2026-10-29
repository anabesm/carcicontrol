import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../lib/http-error";
import type { validateNewCycle } from "./validation";
import { cicloPublicoSelect } from "./viveiro";

export async function openCycle(
  db: PrismaClient,
  viveiroId: number,
  input: ReturnType<typeof validateNewCycle>,
  criadoPor: number,
) {
  try {
    return await db.$transaction(async (tx) => {
      // A atualização condicional disputa a linha do viveiro entre solicitações concorrentes.
      const claimed = await tx.viveiro.updateMany({
        where: { id: viveiroId, status: "DISPONIVEL", ciclos: { none: { status: "ATIVO" } } },
        data: { status: "OCUPADO" },
      });
      if (claimed.count !== 1) {
        const exists = await tx.viveiro.findUnique({
          where: { id: viveiroId },
          select: { id: true },
        });
        if (!exists) throw new HttpError(404, "Viveiro não encontrado.");
        throw new HttpError(409, "O viveiro não está disponível ou já possui um ciclo ativo.");
      }
      return tx.cicloCultivo.create({
        data: { ...input, viveiroId, criadoPor, status: "ATIVO" },
        select: cicloPublicoSelect,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "O viveiro já possui um ciclo ativo.");
    }
    throw error;
  }
}
