import { apiRequest } from './api'
export interface Evento {
  id: number
  viveiroId: number
  cicloId: number | null
  tipo: string
  descricao: string
  dataHora: string
  quantidade: number | null
  responsavel: { id: number; nome: string } | null
  viveiro: { identificador: string }
}
export const eventosApi = {
  list: (query: string) => apiRequest<{ eventos: Evento[]; total: number }>(`/eventos?${query}`),
  create: (body: {
    viveiroId: number
    cicloId: number | null
    tipo: string
    descricao: string
    dataHora: string
  }) => apiRequest('/eventos', { method: 'POST', body }),
}
