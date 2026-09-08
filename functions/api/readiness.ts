import { normalizeCoreApiUrl } from './_coreIdentity'
import { recordOperationalEvent } from './_operations'
import { json, type Env } from './_shared'

const CORE_REQUIRED_ENVIRONMENTS = new Set(['stage', 'staging', 'prod', 'production'])

export function coreIdentityRequired(environment?: string): boolean {
  return CORE_REQUIRED_ENVIRONMENTS.has((environment ?? '').trim().toLowerCase())
}

export function evaluateReadiness(input: {
  environment?: string
  database: boolean
  identityBoundary: boolean
  coreIdentityConfigured: boolean
  storage: boolean
}) {
  const coreRequired = coreIdentityRequired(input.environment)
  const ready = input.database
    && input.identityBoundary
    && input.storage
    && (!coreRequired || input.coreIdentityConfigured)
  return { ready, coreRequired }
}

export const onRequestGet = async ({ env }: { env: Env }) => {
  const coreConfigured = Boolean(env.ACADEMY_CORE_API_URL && normalizeCoreApiUrl(env.ACADEMY_CORE_API_URL))
  const checks = {
    database: false,
    identityBoundary: Boolean(env.ACADEMY_ADMIN_PROXY_SECRET),
    coreIdentityConfigured: coreConfigured,
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

  // DEV/testes podem continuar temporariamente no proxy legado. STAGE/PRODUCTION
  // exigem identidade real confirmada pelo iFarm Core para declarar readiness.
  const evaluation = evaluateReadiness({
    environment: env.ACADEMY_ENVIRONMENT,
    ...checks,
  })
  const ready = evaluation.ready

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
        coreIdentityConfigured: checks.coreIdentityConfigured,
        coreIdentityRequired: evaluation.coreRequired,
        storage: checks.storage,
      },
    })
  }

  return json({
    status: ready ? 'ready' : 'not_ready',
    service: 'ifarm-academy',
    environment: env.ACADEMY_ENVIRONMENT ?? 'unknown',
    release: env.ACADEMY_RELEASE ?? 'unknown',
    identityMode: coreConfigured ? 'core_api' : 'legacy_proxy',
    coreIdentityRequired: evaluation.coreRequired,
    checks,
    timestamp: new Date().toISOString(),
  }, ready ? 200 : 503)
}
