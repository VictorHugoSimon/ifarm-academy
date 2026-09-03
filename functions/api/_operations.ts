import { json, type Env } from './_shared'

export type OperationalSeverity = 'info' | 'warning' | 'error' | 'critical'
export type OperationalEventType =
  | 'rate_limited'
  | 'readiness_failed'
  | 'dependency_unavailable'
  | 'security_boundary_failure'
  | 'maintenance'

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function secureEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

export function resolveRequestId(request: Request): string {
  const provided = request.headers.get('x-request-id')?.trim() ?? ''
  if (provided && provided.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(provided)) return provided
  return crypto.randomUUID()
}

export function resolveRouteScope(request: Request): string {
  const url = new URL(request.url)
  if (url.pathname === '/api/health' || url.pathname === '/api/readiness') return 'health'
  if (url.pathname.startsWith('/api/certificates/public/')) return 'public_certificate'
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return 'read'
  return 'write'
}

export function structuredLog(
  level: 'info' | 'warn' | 'error',
  payload: Record<string, unknown>,
) {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'ifarm-academy',
    ...payload,
  })
  if (level === 'error') console.error(record)
  else if (level === 'warn') console.warn(record)
  else console.log(record)
}

export async function recordOperationalEvent(
  env: Env,
  input: {
    requestId?: string | null
    eventType: OperationalEventType
    severity?: OperationalSeverity
    component: string
    routeScope?: string | null
    statusCode?: number | null
    detailCode?: string | null
    metadata?: Record<string, string | number | boolean | null>
  },
) {
  if (!env.ACADEMY_DB) return
  try {
    await env.ACADEMY_DB.prepare(`
      INSERT INTO academy_operational_events (
        id, request_id, event_type, severity, component, route_scope,
        status_code, detail_code, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      input.requestId ?? null,
      input.eventType,
      input.severity ?? 'warning',
      input.component,
      input.routeScope ?? null,
      input.statusCode ?? null,
      input.detailCode ?? null,
      JSON.stringify(input.metadata ?? {}),
      new Date().toISOString(),
    ).run()
  } catch (error) {
    structuredLog('warn', {
      event: 'operational_event_persistence_failed',
      requestId: input.requestId ?? null,
      component: input.component,
      detail: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('')
}

function trustedIdentity(env: Env, request: Request): string | null {
  const configured = env.ACADEMY_ADMIN_PROXY_SECRET ?? ''
  const provided = request.headers.get('x-ifarm-proxy-secret') ?? ''
  if (!configured || !provided || !secureEqual(configured, provided)) return null
  const userId = request.headers.get('x-ifarm-user-id')?.trim() ?? ''
  const tenantId = request.headers.get('x-ifarm-tenant-id')?.trim() ?? ''
  return userId && tenantId ? `tenant:${tenantId}:user:${userId}` : null
}

function clientIdentity(env: Env, request: Request): string {
  const trusted = trustedIdentity(env, request)
  if (trusted) return trusted
  const ip = request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
  return `ip:${ip}`
}

export async function enforceRateLimit(
  env: Env,
  request: Request,
  requestId: string,
): Promise<Response | null> {
  const routeScope = resolveRouteScope(request)
  if (routeScope === 'health') return null
  if (env.ACADEMY_RATE_LIMIT_ENABLED === 'false' || !env.ACADEMY_DB) return null

  const authenticated = trustedIdentity(env, request) !== null
  const defaultLimit = routeScope === 'write'
    ? positiveInteger(env.ACADEMY_RATE_LIMIT_WRITE_PER_MINUTE, 60)
    : authenticated
      ? positiveInteger(env.ACADEMY_RATE_LIMIT_AUTH_PER_MINUTE, 180)
      : positiveInteger(env.ACADEMY_RATE_LIMIT_PUBLIC_PER_MINUTE, 60)

  const identityHash = await sha256(clientIdentity(env, request))
  const bucketKey = await sha256(`${routeScope}:${identityHash}`)
  const now = Date.now()
  const windowStart = Math.floor(now / 60000) * 60000
  const updatedAt = new Date(now).toISOString()

  try {
    await env.ACADEMY_DB.prepare(`
      INSERT INTO academy_rate_limit_buckets (
        bucket_key, route_scope, window_start, request_count, updated_at
      ) VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(bucket_key) DO UPDATE SET
        route_scope=excluded.route_scope,
        window_start=excluded.window_start,
        request_count=CASE
          WHEN academy_rate_limit_buckets.window_start=excluded.window_start
            THEN academy_rate_limit_buckets.request_count + 1
          ELSE 1
        END,
        updated_at=excluded.updated_at
    `).bind(bucketKey, routeScope, windowStart, updatedAt).run()

    const bucket = await env.ACADEMY_DB.prepare(`
      SELECT request_count FROM academy_rate_limit_buckets
      WHERE bucket_key=? LIMIT 1
    `).bind(bucketKey).first()
    const count = Number(bucket?.request_count ?? 0)
    if (count <= defaultLimit) return null

    await recordOperationalEvent(env, {
      requestId,
      eventType: 'rate_limited',
      component: 'edge_middleware',
      routeScope,
      statusCode: 429,
      detailCode: 'request_limit_exceeded',
      metadata: { limit: defaultLimit },
    })

    const response = json({ error: 'Muitas requisições. Tente novamente em instantes.', requestId }, 429)
    response.headers.set('retry-after', String(Math.max(1, Math.ceil((windowStart + 60000 - now) / 1000))))
    response.headers.set('x-request-id', requestId)
    return response
  } catch (error) {
    structuredLog('warn', {
      event: 'rate_limit_dependency_failed_open',
      requestId,
      routeScope,
      detail: error instanceof Error ? error.message : 'unknown_error',
    })
    return null
  }
}
