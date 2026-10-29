import { apiRequest } from './api'
import type {
  CicloCultivo,
  DetalhesViveiro,
  NovoCiclo,
  NovoViveiro,
  Viveiro,
} from '@/types/viveiro'

export const viveirosApi = {
  list: () => apiRequest<{ viveiros: Viveiro[] }>('/viveiros'),
  detail: (id: string | number) =>
    apiRequest<{ viveiro: DetalhesViveiro }>(`/viveiros/${encodeURIComponent(id)}`),
  create: (input: NovoViveiro) =>
    apiRequest<{ viveiro: Viveiro }>('/viveiros', { method: 'POST', body: input }),
  openCycle: (id: string | number, input: NovoCiclo) =>
    apiRequest<{ ciclo: CicloCultivo }>(`/viveiros/${encodeURIComponent(id)}/ciclos`, {
      method: 'POST',
      body: input,
    }),
}
