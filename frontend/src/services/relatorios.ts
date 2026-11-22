import { apiRequest } from './api'
import type { Resumo } from './indicadores'
import type { Categoria } from './despesas'
export interface IndicadorCiclo {
  id: number
  viveiroId: number
  viveiro: string
  status: string
  motivoEncerramento: string | null
  dataInicio: string
  dataEncerramento: string | null
  areaPovoamentoM2: number | null
  pesoFinalKg: number | null
  quantidadeInicial: number
  quantidadeFinal: number | null
  despesasRegistradas: number
  receitaRegistrada: number
  saldoRegistrado: number
  diasCultivo: number | null
  sobrevivenciaPercentual: number | null
  produtividadeKgHa: number | null
  custoRegistradoPorKg: number | null
  pesoMedioFinalG: number | null
  dadosFaltantes: string[]
}
export interface DiaFinanceiro {
  dia: string
  despesas: number
  receitas: number
}
export interface Relatorio {
  resumo: Resumo
  ciclos: IndicadorCiclo[]
  total: number
  limite: number
  offset: number
  custosPorCategoria: { categoria: Categoria; valor: number }[]
  financeiroPorDia: DiaFinanceiro[]
}
export const relatoriosApi = {
  get: (query: string) => apiRequest<Relatorio>(`/relatorios?${query}`),
}
