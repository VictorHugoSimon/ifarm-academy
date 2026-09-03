export interface Env {
  ACADEMY_DB?: any
  ACADEMY_STORAGE?: any
  ACADEMY_ADMIN_PROXY_SECRET?: string
  ACADEMY_ENVIRONMENT?: string
  ACADEMY_RELEASE?: string
  ACADEMY_STORAGE_REQUIRED?: string
  ACADEMY_RATE_LIMIT_ENABLED?: string
  ACADEMY_RATE_LIMIT_PUBLIC_PER_MINUTE?: string
  ACADEMY_RATE_LIMIT_AUTH_PER_MINUTE?: string
  ACADEMY_RATE_LIMIT_WRITE_PER_MINUTE?: string
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

export function dbOr503(env: Env): any | Response {
  if (!env.ACADEMY_DB) return json({ error: 'ACADEMY_DB binding not configured' }, 503)
  return env.ACADEMY_DB
}

export function storageOr503(env: Env): any | Response {
  if (!env.ACADEMY_STORAGE) return json({ error: 'ACADEMY_STORAGE binding not configured' }, 503)
  return env.ACADEMY_STORAGE
}

export async function bodyJson(request: Request): Promise<Record<string, unknown>> {
  try { return await request.json() as Record<string, unknown> }
  catch { throw new Error('JSON inválido') }
}

export const allowedAttemptTransitions: Record<string, string[]> = {
  in_progress: ['submitted'],
  submitted: ['manual_review', 'approved', 'failed'],
  manual_review: ['approved', 'failed'],
  approved: [],
  failed: [],
}

export function safeJson(value: unknown, fallback: unknown) {
  if (typeof value !== 'string' || !value) return fallback
  try { return JSON.parse(value) } catch { return fallback }
}
