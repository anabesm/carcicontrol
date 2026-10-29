import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../lib/http-error";
import { demoParameters } from "../medicoes/definitions";

export async function seedDemoMedicoes(db: PrismaClient, adminId: number) {
  return db.$transaction(async (tx) => {
    const admin = await tx.usuario.findFirst({
      where: { id: adminId, perfil: "ADMINISTRADOR", status: "ATIVO" },
      select: { id: true },
    });
    if (!admin)
      throw new HttpError(
        403,
        "Use um administrador ativo para preparar as faixas de demonstração.",
      );
    let parametersCreated = 0;
    let rangesCreated = 0;
    for (const definition of demoParameters) {
      let parameter = await tx.parametro.findUnique({ where: { codigo: definition.codigo } });
      if (!parameter) {
        parameter = await tx.parametro.create({
          data: {
            codigo: definition.codigo,
            nome: definition.nome,
            unidadePadrao: definition.unidadePadrao,
            minPossivel: definition.minPossivel,
            maxPossivel: definition.maxPossivel,
          },
        });
        parametersCreated++;
      } else if (
        !parameter.ativo ||
        parameter.unidadePadrao !== definition.unidadePadrao ||
        parameter.minPossivel === null ||
        parameter.maxPossivel === null ||
        parameter.minPossivel > definition.minIdeal ||
        parameter.maxPossivel < definition.maxIdeal
      ) {
        throw new HttpError(
          409,
          `O parâmetro ${definition.codigo} já existe com configuração incompatível. Os dados existentes foram preservados.`,
        );
      }
      const existingRange = await tx.faixaParametro.findFirst({
        where: { parametroId: parameter.id, viveiroId: null, ativo: true },
        select: { id: true },
      });
      if (!existingRange) {
        await tx.faixaParametro.create({
          data: {
            parametroId: parameter.id,
            minIdeal: definition.minIdeal,
            maxIdeal: definition.maxIdeal,
            descricao: "Exemplo de faixa ideal para demonstração",
            demonstrativa: true,
            criadoPor: admin.id,
          },
        });
        rangesCreated++;
      }
    }
    return { parametersCreated, rangesCreated };
  });
}
