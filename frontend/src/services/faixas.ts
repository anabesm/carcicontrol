import { apiRequest } from './api'
export interface ParametroConfiguravel {
  id: number
  codigo: string
  nome: string
  unidadePadrao: string
  minPossivel: number
  maxPossivel: number
}
export interface Faixa {
  id: number
  parametroId: number
  viveiroId: number | null
  minIdeal: number
  maxIdeal: number
  minCritico: number | null
  maxCritico: number | null
  faseNome: string | null
  diaInicial: number
  diaFinal: number | null
  descricao: string | null
  demonstrativa: boolean
  ativo: boolean
  minAcaoRecomendada: string | null
  maxAcaoRecomendada: string | null
  parametro: { nome: string; unidadePadrao: string }
  viveiro: { identificador: string } | null
}
export type NewRange = Omit<Faixa, 'id' | 'ativo' | 'parametro' | 'viveiro'>
export const faixasApi = {
  catalog: () => apiRequest<{ parametros: ParametroConfiguravel[] }>('/faixas/parametros'),
  list: () => apiRequest<{ faixas: Faixa[] }>('/faixas'),
  save: (body: NewRange, previousId?: number) =>
    apiRequest(`/faixas${previousId ? `/${previousId}` : ''}`, {
      method: previousId ? 'PUT' : 'POST',
      body,
    }),
  deactivate: (id: number) =>
    apiRequest(`/faixas/${id}`, { method: 'PATCH', body: { ativo: false } }),
}
