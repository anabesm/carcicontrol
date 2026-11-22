import { apiRequest } from './api'
export interface Rotina {
  id: number
  parametroId: number
  viveiroId: number | null
  horario: string
  fuso: string
  toleranciaMinutos: number
  ativo: boolean
  parametro: { nome: string; unidadePadrao: string }
  viveiro: { identificador: string } | null
}
export interface Pendencia {
  cicloId: number
  viveiroId: number
  viveiro: string
  rotinaId: number
  parametro: { id: number; nome: string; unidadePadrao: string }
  esperadoEm: string
  fimJanela: string
  fuso: string
  horario: string
  situacao: 'CONCLUIDA' | 'PENDENTE' | 'AGUARDANDO'
  medicao: { valor: number; unidade: string; medidoEm: string } | null
}
export const rotinasApi = {
  list: () => apiRequest<{ rotinas: Rotina[] }>('/rotinas'),
  pending: (query: string) =>
    apiRequest<{ pendencias: Pendencia[]; total: number }>(`/rotinas/pendencias?${query}`),
  save: (
    body: {
      parametroId: number
      viveiroId: number | null
      horario: string
      fuso: string
      toleranciaMinutos: number
    },
    id?: number,
  ) => apiRequest(`/rotinas${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body }),
  deactivate: (id: number) =>
    apiRequest(`/rotinas/${id}`, { method: 'PATCH', body: { ativo: false } }),
}
