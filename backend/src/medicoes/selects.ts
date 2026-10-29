import type { Prisma } from "@prisma/client";

export const parametroConfigSelect = {
  id: true,
  codigo: true,
  nome: true,
  unidadePadrao: true,
  minPossivel: true,
  maxPossivel: true,
  ativo: true,
  faixas: {
    where: { ativo: true },
    select: {
      id: true,
      viveiroId: true,
      minIdeal: true,
      maxIdeal: true,
      minCritico: true,
      maxCritico: true,
      descricao: true,
      demonstrativa: true,
    },
  },
} satisfies Prisma.ParametroSelect;
export type ParametroConfig = Prisma.ParametroGetPayload<{ select: typeof parametroConfigSelect }>;
export type FaixaConfig = ParametroConfig["faixas"][number];

export const alertaBaseSelect = {
  id: true,
  dataHora: true,
  valorMedido: true,
  limiteViolado: true,
  gravidade: true,
  status: true,
  observacao: true,
} satisfies Prisma.AlertaSelect;

export const medicaoBaseSelect = {
  id: true,
  valor: true,
  unidade: true,
  medidoEm: true,
  criadoEm: true,
  confirmadaForaFaixa: true,
  faixaParametroId: true,
  minIdealAplicado: true,
  maxIdealAplicado: true,
  faixaDemonstrativa: true,
  parametro: { select: { id: true, codigo: true, nome: true } },
  registradoPor: { select: { id: true, nome: true } },
  ciclo: {
    select: { id: true, status: true, viveiro: { select: { id: true, identificador: true } } },
  },
} satisfies Prisma.MedicaoSelect;

export const medicaoPublicSelect = {
  ...medicaoBaseSelect,
  alertas: { select: alertaBaseSelect, orderBy: { id: "asc" } },
} satisfies Prisma.MedicaoSelect;
type MedicaoBase = Prisma.MedicaoGetPayload<{ select: typeof medicaoBaseSelect }>;

export function publicMedicao<T extends MedicaoBase>(row: T) {
  const { faixaParametroId, minIdealAplicado, maxIdealAplicado, faixaDemonstrativa, ...medicao } =
    row;
  return {
    ...medicao,
    faixaAplicada:
      minIdealAplicado === null || maxIdealAplicado === null
        ? null
        : {
            id: faixaParametroId,
            minIdeal: minIdealAplicado,
            maxIdeal: maxIdealAplicado,
            demonstrativa: faixaDemonstrativa,
          },
  };
}
