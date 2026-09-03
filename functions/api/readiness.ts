import { recordOperationalEvent } from './_operations'
import { json, type Env } from './_shared'

export const onRequestGet = async ({ env }: { env: Env }) => {
  const checks = {
    database: false,
    identityBoundary: Boolean(env.ACADEMY_ADMIN_PROXY_SECRET),
    storage: env.ACADEMY_STORAGE_REQUIRED === 'true' ? Boolean(env.ACADEMY_STORAGE) : true,
  }

  if (env.ACADEMY_DB) {
    try {
      const result = await env.ACADEMY_DB.prepare('SELECT 1 AS ok').first()
      checks.database = Number(result?.ok ?? 0) === 1
    } catch {
      checks.database = false
    }
  }

  const ready = checks.database && checks.identityBoundary && checks.storage
  if (!ready) {
    await recordOperationalEvent(env, {
      eventType: 'readiness_failed',
      severity: 'error',
      component: 'readiness',
      routeScope: 'health',
      statusCode: 503,
      detailCode: 'runtime_dependency_not_ready',
      metadata: {
        database: checks.database,
        identityBoundary: checks.identityBoundary,
        storage: checks.storage,
      },
    })
  }

  return json({
    status: ready ? 'ready' : 'not_ready',
    service: 'ifarm-academy',
    environment: env.ACADEMY_ENVIRONMENT ?? 'unknown',
    release: env.ACADEMY_RELEASE ?? 'unknown',
    checks,
    timestamp: new Date().toISOString(),
  }, ready ? 200 : 503)
}
