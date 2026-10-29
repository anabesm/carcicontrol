import { apiRequest } from './api'
import type { NovoFuncionario, Usuario } from '@/types/usuario'

export const employeesApi = {
  list: () => apiRequest<{ usuarios: Usuario[] }>('/usuarios'),
  create: (funcionario: NovoFuncionario) =>
    apiRequest<{ usuario: Usuario }>('/usuarios', { method: 'POST', body: funcionario }),
}
