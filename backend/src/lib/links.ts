import type { Prisma } from "@prisma/client";
import { HttpError } from "./http-error";

export async function validateLinks(
  tx: Prisma.TransactionClient,
  viveiroId: number | null,
  cicloId: number | null,
  when?: Date,
) {
  if (cicloId !== null) {
    const rows = await tx.$queryRaw<
      Array<{
        id: number;
        viveiroId: number;
        dataInicio: Date;
        dataEncerramento: Date | null;
      }>
    >`SELECT "id", "viveiroId", "dataInicio", "dataEncerramento" FROM "CicloCultivo" WHERE "id" = ${cicloId} FOR UPDATE`;
    const cycle = rows[0];
    if (!cycle) throw new HttpError(404, "Ciclo não encontrado.");
    if (viveiroId !== null && cycle.viveiroId !== viveiroId)
      throw new HttpError(400, "O ciclo não pertence ao viveiro informado.");
    if (
      when &&
      (when < cycle.dataInicio ||
        (cycle.dataEncerramento && when > cycle.dataEncerramento))
    )
      throw new HttpError(400, "A data deve estar dentro do período do ciclo.");
    viveiroId = cycle.viveiroId;
  }
  if (
    viveiroId !== null &&
    !(await tx.viveiro.findUnique({
      where: { id: viveiroId },
      select: { id: true },
    }))
  )
    throw new HttpError(404, "Viveiro não encontrado.");
  return { viveiroId, cicloId };
}
