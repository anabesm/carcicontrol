import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { authApi } from '@/services/auth'
import { ApiError } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { Usuario } from '@/types/usuario'

vi.mock('@/services/auth', () => ({
  authApi: {
    me: vi.fn<typeof authApi.me>(),
    login: vi.fn<typeof authApi.login>(),
    logout: vi.fn<typeof authApi.logout>(),
  },
}))
const employee: Usuario = {
  id: 1,
  nome: 'Pessoa da equipe',
  email: 'pessoa@example.test',
  telefone: null,
  perfil: 'FUNCIONARIO',
  status: 'ATIVO',
  criadoEm: '2026-10-28T00:00:00.000Z',
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  vi.resetAllMocks()
})

describe('sessão autenticada', () => {
  it('normaliza o e-mail e usa somente o perfil recebido do servidor', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ usuario: employee })
    const auth = useAuthStore()
    await auth.signIn(' PESSOA@EXAMPLE.TEST ', 'senha de teste')
    expect(authApi.login).toHaveBeenCalledWith('pessoa@example.test', 'senha de teste')
    expect(auth.usuario).toEqual(employee)
    expect(auth.isAdmin).toBe(false)
    expect(Object.keys(sessionStorage)).toEqual(['carcicontrol-session-present'])
    expect(sessionStorage.getItem('carcicontrol-session-present')).toBe('1')
  })

  it('mantém o visitante sem acesso quando as credenciais são recusadas', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, 'E-mail ou senha inválidos.'))
    const auth = useAuthStore()
    await expect(auth.signIn(employee.email, 'incorreta')).rejects.toMatchObject({ status: 401 })
    expect(auth.usuario).toBeNull()
    expect(auth.notice).toBeNull()
  })

  it('restaura o usuário pelo servidor em uma nova instância e compartilha verificações simultâneas', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ usuario: employee })
    const auth = useAuthStore()
    await Promise.all([auth.restoreSession(), auth.restoreSession()])
    expect(authApi.me).toHaveBeenCalledOnce()
    expect(auth.usuario).toEqual(employee)
  })

  it('limpa o usuário e avisa a expiração após uma sessão recusada', async () => {
    const auth = useAuthStore()
    auth.usuario = employee
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, 'Sessão expirada.'))
    await expect(auth.restoreSession()).resolves.toBeNull()
    expect(auth.usuario).toBeNull()
    expect(auth.notice).toBe('expired')
  })

  it('reconhece uma sessão expirada após recarregar a página', async () => {
    sessionStorage.setItem('carcicontrol-session-present', '1')
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, 'Sessão expirada.'))
    const auth = useAuthStore()
    await auth.restoreSession()
    expect(auth.notice).toBe('expired')
    expect(sessionStorage.length).toBe(0)
  })

  it('preserva a sessão e distingue indisponibilidade de expiração', async () => {
    const auth = useAuthStore()
    auth.usuario = employee
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(0, 'Sem conexão.'))
    await expect(auth.restoreSession()).rejects.toMatchObject({ status: 0 })
    expect(auth.usuario).toEqual(employee)
    expect(auth.connectionError).toBe('Sem conexão.')
    expect(auth.notice).toBeNull()
  })

  it('só limpa o acesso depois que o logout foi confirmado', async () => {
    const auth = useAuthStore()
    auth.usuario = employee
    vi.mocked(authApi.logout).mockRejectedValueOnce(new ApiError(0, 'Sem conexão.'))
    await expect(auth.signOut()).rejects.toMatchObject({ status: 0 })
    expect(auth.usuario).toEqual(employee)
    vi.mocked(authApi.logout).mockResolvedValueOnce(undefined)
    await auth.signOut()
    expect(auth.usuario).toBeNull()
    expect(auth.notice).toBe('signed-out')
  })

  it('aceita encerrar uma sessão já invalidada pelo backend', async () => {
    const auth = useAuthStore()
    auth.usuario = employee
    vi.mocked(authApi.logout).mockRejectedValue(new ApiError(401, 'Sessão expirada.'))
    await auth.signOut()
    expect(auth.usuario).toBeNull()
  })

  it('uma verificação atrasada não restaura o usuário depois de sair', async () => {
    let finish!: (result: { usuario: Usuario }) => void
    vi.mocked(authApi.me).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    vi.mocked(authApi.logout).mockResolvedValue(undefined)
    const auth = useAuthStore()
    const request = auth.restoreSession()
    await auth.signOut()
    finish({ usuario: employee })
    await request
    expect(auth.usuario).toBeNull()
  })
})
