import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/router'
import { authApi } from '@/services/auth'
import { ApiError, setUnauthorizedHandler } from '@/services/api'
import { safeRedirect } from '@/utils/access'
import type { Usuario } from '@/types/usuario'

vi.mock('@/services/auth', () => ({
  authApi: {
    me: vi.fn<typeof authApi.me>(),
    login: vi.fn<typeof authApi.login>(),
    logout: vi.fn<typeof authApi.logout>(),
  },
}))
const admin: Usuario = {
  id: 1,
  nome: 'Administrador',
  email: 'admin@example.test',
  telefone: null,
  perfil: 'ADMINISTRADOR',
  status: 'ATIVO',
  criadoEm: '2026-10-28T00:00:00.000Z',
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  sessionStorage.clear()
})
afterEach(() => setUnauthorizedHandler())
const newRouter = () => createAppRouter(createMemoryHistory(), createPinia())

describe('proteção das rotas', () => {
  it('redireciona visitantes ao login e preserva o destino local', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, 'Sem sessão.'))
    const router = newRouter()
    await router.push('/funcionarios/novo')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/funcionarios/novo')
  })

  it('permite ao administrador abrir diretamente o cadastro', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ usuario: admin })
    const router = newRouter()
    await router.push('/funcionarios/novo')
    expect(router.currentRoute.value.path).toBe('/funcionarios/novo')
  })

  it.each(['/funcionarios', '/funcionarios/novo'])(
    'bloqueia o funcionário em %s, inclusive por URL direta',
    async (path) => {
      vi.mocked(authApi.me).mockResolvedValue({ usuario: { ...admin, perfil: 'FUNCIONARIO' } })
      const router = newRouter()
      await router.push(path)
      expect(router.currentRoute.value.path).toBe('/acesso-negado')
    },
  )

  it('permite a navegação operacional do funcionário após restaurar a sessão', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ usuario: { ...admin, perfil: 'FUNCIONARIO' } })
    const router = newRouter()
    await router.push('/viveiros')
    expect(router.currentRoute.value.path).toBe('/viveiros')
    expect(authApi.me).toHaveBeenCalled()
  })

  it('mostra opção de tentar novamente se a verificação falhar por conexão', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(0, 'Sem conexão.'))
    const router = newRouter()
    await router.push('/funcionarios')
    expect(router.currentRoute.value.path).toBe('/conexao')
    expect(router.currentRoute.value.query.redirect).toBe('/funcionarios')
  })
})

describe('retorno após login', () => {
  it.each([
    'https://example.test',
    '//example.test',
    '/\\example.test',
    '/login?redirect=/',
    '/conexao',
    undefined,
  ])('recusa o destino inseguro ou circular %s', (destination) => {
    expect(safeRedirect(destination)).toBe('/')
  })
  it('preserva uma rota interna com busca', () => {
    expect(safeRedirect('/funcionarios?busca=ana')).toBe('/funcionarios?busca=ana')
  })
})
