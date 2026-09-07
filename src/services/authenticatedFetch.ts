import { authClient } from './authClient'

const nativeFetch = globalThis.fetch.bind(globalThis)

function requestHeaders(input: RequestInfo | URL, init: RequestInit): Headers {
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  const override = new Headers(init.headers)
  override.forEach((value, key) => headers.set(key, value))
  return headers
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = requestHeaders(input, init)
  if (!headers.has('authorization')) {
    const token = await authClient.getJWTToken()
    if (!token) throw new Error('Sessão iFarm ausente ou expirada. Entre novamente para continuar.')
    headers.set('authorization', `Bearer ${token}`)
  }
  if (!headers.has('accept')) headers.set('accept', 'application/json')
  return nativeFetch(input, { ...init, headers })
}

export async function authenticatedJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(input, init)
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload.message === 'string'
      ? payload.message
      : payload && typeof payload.error === 'string'
        ? payload.error
        : `Academy API ${response.status}`
    throw new Error(message)
  }
  return payload as T
}

export function nativeAcademyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return nativeFetch(input, init)
}
