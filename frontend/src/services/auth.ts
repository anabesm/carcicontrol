import { apiRequest } from './api'
import type { Usuario } from '@/types/usuario'

export const authApi = {
  me: () => apiRequest<{ usuario: Usuario }>('/auth/me', { notifyUnauthorized: false }),
  login: (email: string, senha: string) =>
    apiRequest<{ usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: { email, senha },
      notifyUnauthorized: false,
    }),
  logout: () => apiRequest('/auth/logout', { method: 'POST', notifyUnauthorized: false }),
}
