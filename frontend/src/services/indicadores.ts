import { apiRequest } from './api'
export interface Resumo {
  viveiros: Record<string, number>
  ciclosAtivos: number
  alertasPendentes: number
  atualizadoEm: string
  financeiro?: {
    despesas: number
    receitas: number
    saldoRegistrado: number
    pesoVendidoKg: number
  }
}
export interface PontoMedicao {
  id: number
  valor: number
  unidade: string
  medidoEm: string
  cicloId: number
  minIdealAplicado: number | null
  maxIdealAplicado: number | null
}
export interface Evolucao {
  parametro: { id: number; nome: string; unidadePadrao: string }
  medicoes: PontoMedicao[]
  truncado: boolean
}
export const indicadoresApi = {
  summary: (query: string) => apiRequest<Resumo>(`/indicadores/resumo?${query}`),
  evolution: (query: string) => apiRequest<Evolucao>(`/indicadores/evolucao?${query}`),
}
