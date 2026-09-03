import { requireAdminContext } from './_auth'
import { dbOr503, json, safeJson, type Env } from './_shared'

const roles = ['ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, roles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const now = new Date()
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const grouped = await db.prepare(`
    SELECT event_type, severity, COUNT(*) AS total
    FROM academy_operational_events
    WHERE created_at>=?
    GROUP BY event_type, severity
    ORDER BY total DESC, event_type
  `).bind(since).all()

  const recent = await db.prepare(`
    SELECT request_id, event_type, severity, component, route_scope,
      status_code, detail_code, metadata_json, created_at
    FROM academy_operational_events
    WHERE created_at>=?
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(since).all()

  const activeBuckets = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM academy_rate_limit_buckets
    WHERE updated_at>=?
  `).bind(new Date(now.getTime() - 5 * 60 * 1000).toISOString()).first()

  return json({
    generatedAt: now.toISOString(),
    environment: env.ACADEMY_ENVIRONMENT ?? 'unknown',
    release: env.ACADEMY_RELEASE ?? 'unknown',
    rateLimiting: {
      enabled: env.ACADEMY_RATE_LIMIT_ENABLED !== 'false',
      activeBucketsLast5Minutes: Number(activeBuckets?.total ?? 0),
    },
    last24Hours: {
      grouped: (grouped.results as any[]).map((row) => ({
        eventType: row.event_type,
        severity: row.severity,
        total: Number(row.total ?? 0),
      })),
      recent: (recent.results as any[]).map((row) => ({
        requestId: row.request_id ?? null,
        eventType: row.event_type,
        severity: row.severity,
        component: row.component,
        routeScope: row.route_scope ?? null,
        statusCode: row.status_code == null ? null : Number(row.status_code),
        detailCode: row.detail_code ?? null,
        metadata: safeJson(row.metadata_json, {}),
        createdAt: row.created_at,
      })),
    },
  })
}
