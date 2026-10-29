import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, setUnauthorizedHandler } from '../services/api'

afterEach(() => {
  vi.unstubAllGlobals()
  setUnauthorizedHandler()
})

describe('cliente da API', () => {
  it('envia JSON e cookies para a API pela mesma origem', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ usuario: { id: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'teste@example.test', senha: 'teste' },
    })
    expect(result).toEqual({ usuario: { id: 1 } })
    const [url, options] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/auth/login')
    expect(options?.credentials).toBe('include')
    expect(new Headers(options?.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(options?.body))).toEqual({
      email: 'teste@example.test',
      senha: 'teste',
    })
  })

  it('preserva o status e a mensagem de uma sessão recusada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Sessão expirada.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    await expect(apiRequest('/auth/me')).rejects.toMatchObject({
      status: 401,
      message: 'Sessão expirada.',
    })
  })

  it('aceita a resposta vazia de logout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })),
    )
    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('converte falha de conexão em um erro compreensível', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')),
    )
    await expect(apiRequest('/health')).rejects.toBeInstanceOf(ApiError)
    await expect(apiRequest('/health')).rejects.toMatchObject({ status: 0 })
  })

  it('avisa a aplicação quando uma solicitação protegida retorna 401', async () => {
    const expired = vi.fn<() => void>()
    setUnauthorizedHandler(expired)
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 })),
    )
    await expect(apiRequest('/usuarios')).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledOnce()
  })

  it('não confunde credenciais inválidas com sessão expirada', async () => {
    const expired = vi.fn<() => void>()
    setUnauthorizedHandler(expired)
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 })),
    )
    await expect(apiRequest('/auth/login', { notifyUnauthorized: false })).rejects.toMatchObject({
      status: 401,
    })
    expect(expired).not.toHaveBeenCalled()
  })

  it('ignora um 401 atrasado de uma sessão anterior', async () => {
    let version = 1
    let finish!: (response: Response) => void
    const expired = vi.fn<() => void>()
    setUnauthorizedHandler(expired, () => version)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      ),
    )
    const request = apiRequest('/usuarios')
    version++
    finish(new Response(null, { status: 401 }))
    await expect(request).rejects.toMatchObject({ status: 401 })
    expect(expired).not.toHaveBeenCalled()
  })
})
