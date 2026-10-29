import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from '../services/api'

afterEach(() => vi.unstubAllGlobals())

describe('cliente da API', () => {
  it('envia JSON e cookies para a API pela mesma origem', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
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
    expect(options.credentials).toBe('include')
    expect(options.headers.get('Content-Type')).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ email: 'teste@example.test', senha: 'teste' })
  })

  it('preserva o status e a mensagem de uma sessão recusada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('converte falha de conexão em um erro compreensível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(apiRequest('/health')).rejects.toBeInstanceOf(ApiError)
    await expect(apiRequest('/health')).rejects.toMatchObject({ status: 0 })
  })
})
