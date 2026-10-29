export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface ApiOptions extends Omit<RequestInit, 'body' | 'credentials'> {
  body?: unknown
}

export async function apiRequest<T = void>(path: string, options: ApiOptions = {}): Promise<T> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  const { body, ...requestOptions } = options

  let response: Response
  try {
    response = await fetch(`${baseUrl}/${path.replace(/^\//, '')}`, {
      ...requestOptions,
      headers,
      credentials: 'include',
      signal: options.signal ?? AbortSignal.timeout(10_000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Não foi possível conectar ao sistema. Tente novamente.')
  }

  if (response.status === 204) return undefined as T

  const isJson = response.headers.get('Content-Type')?.includes('application/json')
  const data: unknown = isJson ? await response.json().catch(() => undefined) : undefined
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Não foi possível concluir a solicitação. Tente novamente.'
    throw new ApiError(response.status, message)
  }
  if (data === undefined)
    throw new ApiError(response.status, 'O sistema retornou uma resposta inválida.')
  return data as T
}
