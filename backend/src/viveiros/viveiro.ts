import type { Prisma } from "@prisma/client";

export const cicloPublicoSelect = {
  id: true,
  viveiroId: true,
  status: true,
  dataInicio: true,
  qtdLarvasInicial: true,
  fornecedorLarvas: true,
  previsaoDespesca: true,
  dataEncerramento: true,
  pesoFinal: true,
  criadoPor: true,
  criadoEm: true,
  atualizadoEm: true,
} satisfies Prisma.CicloCultivoSelect;

export const viveiroPublicoSelect = {
  id: true,
  identificador: true,
  area: true,
  profundidadeMedia: true,
  localizacao: true,
  status: true,
  criadoEm: true,
  atualizadoEm: true,
} satisfies Prisma.ViveiroSelect;

export const cicloOrder = [
  { dataInicio: "desc" },
  { id: "desc" },
] satisfies Prisma.CicloCultivoOrderByWithRelationInput[];
