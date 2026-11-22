import { apiRequest } from './api'
import type {
  Medicao,
  NovaMedicao,
  PaginaAlertas,
  PaginaMedicoes,
  Parametro,
} from '@/types/medicao'

function historyQuery(cicloId: number, offset: number) {
  return new URLSearchParams({ cicloId: String(cicloId), limite: '10', offset: String(offset) })
}

export const medicoesApi = {
  parameters: (cicloId: number) =>
    apiRequest<{ parametros: Parametro[] }>(`/parametros?cicloId=${cicloId}`),
  list: (cicloId: number, offset = 0) =>
    apiRequest<PaginaMedicoes>(`/medicoes?${historyQuery(cicloId, offset)}`),
  alerts: (cicloId: number, offset = 0, status = '') =>
    apiRequest<PaginaAlertas>(
      `/alertas?${historyQuery(cicloId, offset)}${status ? `&status=${encodeURIComponent(status)}` : ''}`,
    ),
  resolveAlert: (id: number, status: 'RESOLVIDO' | 'IGNORADO', observacao: string) =>
    apiRequest(`/alertas/${id}`, { method: 'PATCH', body: { status, observacao } }),
  create: (input: NovaMedicao) =>
    apiRequest<{ medicao: Medicao }>('/medicoes', { method: 'POST', body: input }),
}
