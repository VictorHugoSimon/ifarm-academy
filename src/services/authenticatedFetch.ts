import { authClient } from './authClient'

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (!headers.has('authorization')) {
    const token = await authClient.getJWTToken()
    if (token) headers.set('authorization', `Bearer ${token}`)
  }
  if (!headers.has('accept')) headers.set('accept', 'application/json')
  return fetch(input, { ...init, headers })
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
