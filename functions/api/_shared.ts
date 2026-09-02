export interface Env { ACADEMY_DB?: any }

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

export function dbOr503(env: Env): any | Response {
  if (!env.ACADEMY_DB) return json({ error: 'ACADEMY_DB binding not configured' }, 503)
  return env.ACADEMY_DB
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
