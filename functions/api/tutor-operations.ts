import { requireAdminContext } from './_auth'
import { tutorProviderRuntimeStatus } from './_tutorProvider'
import { tutorUsageForPolicy, type TutorUsagePolicyRow } from './_tutorQuota'
import { dbOr503, json, type Env } from './_shared'

const allowedRoles = ['academy_admin', 'ifarm_admin']

function clampDays(value: string | null): number {
  const parsed = Number(value ?? 7)
  if (!Number.isFinite(parsed)) return 7
  return Math.min(30, Math.max(1, Math.trunc(parsed)))
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const days = clampDays(new URL(request.url).searchParams.get('days'))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [summary, outcomes, guardrails, policies, courses] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) AS total_events,
        SUM(CASE WHEN outcome<>'config_error' THEN 1 ELSE 0 END) AS attempted_calls,
        SUM(CASE WHEN outcome='success' THEN 1 ELSE 0 END) AS successful_calls,
        COALESCE(AVG(CASE WHEN outcome<>'config_error' THEN latency_ms END),0) AS avg_latency_ms,
        COALESCE(SUM(CASE WHEN outcome<>'config_error' THEN request_chars ELSE 0 END),0) AS request_chars,
        COALESCE(SUM(CASE WHEN outcome<>'config_error' THEN response_chars ELSE 0 END),0) AS response_chars
      FROM academy_tutor_provider_events
      WHERE tenant_id=? AND created_at>=?
    `).bind(auth.tenantId, since).first(),
    db.prepare(`
      SELECT outcome, COUNT(*) AS total
      FROM academy_tutor_provider_events
      WHERE tenant_id=? AND created_at>=?
      GROUP BY outcome ORDER BY total DESC, outcome
    `).bind(auth.tenantId, since).all(),
    db.prepare(`
      SELECT event_type, reason_code, COUNT(*) AS total
      FROM academy_tutor_guardrail_events
      WHERE tenant_id=? AND created_at>=?
      GROUP BY event_type, reason_code
      ORDER BY total DESC, event_type, reason_code
    `).bind(auth.tenantId, since).all(),
    db.prepare(`
      SELECT id, tenant_id, scope_type, scope_id, period, version,
             max_provider_requests, max_request_chars, status, rationale,
             approved_by, approved_at, archived_at, created_at
      FROM academy_tutor_usage_policies
      WHERE tenant_id=? AND status='active'
      ORDER BY scope_type, scope_id, period
    `).bind(auth.tenantId).all(),
    db.prepare(`
      SELECT e.course_id, c.title,
             COUNT(*) AS total,
             SUM(CASE WHEN e.outcome='success' THEN 1 ELSE 0 END) AS success
      FROM academy_tutor_provider_events e
      JOIN academy_courses c ON c.id=e.course_id AND c.tenant_id=e.tenant_id
      WHERE e.tenant_id=? AND e.created_at>=? AND e.outcome<>'config_error'
      GROUP BY e.course_id, c.title
      ORDER BY total DESC, c.title
      LIMIT 20
    `).bind(auth.tenantId, since).all(),
  ])

  const activePolicies = []
  for (const row of policies.results as TutorUsagePolicyRow[]) {
    activePolicies.push(await tutorUsageForPolicy(db, row))
  }

  const attempted = Number(summary?.attempted_calls ?? 0)
  const success = Number(summary?.successful_calls ?? 0)
  const quotaBlocks = (guardrails.results as any[])
    .filter((row) => String(row.event_type) === 'quota_block')
    .reduce((total, row) => total + Number(row.total ?? 0), 0)
  const promptRisks = (guardrails.results as any[])
    .filter((row) => String(row.event_type) === 'prompt_risk')
    .reduce((total, row) => total + Number(row.total ?? 0), 0)

  return json({
    data: {
      period: { days, since },
      providerRuntime: tutorProviderRuntimeStatus(env),
      metrics: {
        totalProviderEvents: Number(summary?.total_events ?? 0),
        attemptedCalls: attempted,
        successfulCalls: success,
        successRate: attempted > 0 ? Number(((success / attempted) * 100).toFixed(2)) : 0,
        averageLatencyMs: Math.round(Number(summary?.avg_latency_ms ?? 0)),
        requestChars: Number(summary?.request_chars ?? 0),
        responseChars: Number(summary?.response_chars ?? 0),
        quotaBlocks,
        promptRisks,
      },
      outcomes: outcomes.results,
      guardrails: guardrails.results,
      activePolicies,
      courses: courses.results,
    },
  })
}
