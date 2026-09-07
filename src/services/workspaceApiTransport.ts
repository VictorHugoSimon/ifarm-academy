import { authenticatedFetch, nativeAcademyFetch } from './authenticatedFetch'

let installed = false

export function isWorkspaceApiRequest(input: RequestInfo | URL, origin = globalThis.location?.origin ?? 'http://localhost'): boolean {
  try {
    const raw = input instanceof Request ? input.url : String(input)
    const url = new URL(raw, origin)
    return url.origin === origin && url.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

export function installWorkspaceApiTransport(): void {
  if (installed || typeof globalThis.fetch !== 'function') return
  const origin = globalThis.location?.origin
  if (!origin) return

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (isWorkspaceApiRequest(input, origin)) return authenticatedFetch(input, init)
    return nativeAcademyFetch(input, init)
  }) as typeof fetch
  installed = true
}
