import { apiRequest } from './api'
import type { NovoFuncionario, Usuario } from '@/types/usuario'

export const employeesApi = {
  detail: (id: string) => apiRequest<{ usuario: Usuario }>(`/usuarios/${id}`),
  update: (
    id: string,
    body: { nome?: string; email?: string; telefone?: string | null; status?: 'ATIVO' | 'INATIVO' },
  ) => apiRequest<{ usuario: Usuario }>(`/usuarios/${id}`, { method: 'PATCH', body }),
  resetPassword: (id: string, senha: string) =>
    apiRequest(`/usuarios/${id}/senha`, { method: 'POST', body: { senha } }),
  list: () => apiRequest<{ usuarios: Usuario[] }>('/usuarios'),
  create: (funcionario: NovoFuncionario) =>
    apiRequest<{ usuario: Usuario }>('/usuarios', { method: 'POST', body: funcionario }),
}
