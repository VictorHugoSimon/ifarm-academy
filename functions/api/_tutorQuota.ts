export type TutorQuotaScope = 'tenant' | 'course' | 'student'
export type TutorQuotaPeriod = 'day' | 'month'

export interface TutorUsagePolicyRow {
  id: string
  tenant_id: string
  scope_type: TutorQuotaScope
  scope_id?: string | null
  period: TutorQuotaPeriod
  version: number
  max_provider_requests?: number | null
  max_request_chars?: number | null
  status: 'active' | 'archived'
  rationale: string
  approved_by: string
  approved_at: string
  archived_at?: string | null
  created_at: string
}

export interface TutorUsageSnapshot {
  providerRequests: number
  requestChars: number
}

export interface TutorUsagePolicyEvaluation {
  policy: TutorUsagePolicyRow
  usage: TutorUsageSnapshot
  windowStartedAt: string
}

export interface TutorQuotaDecision {
  allowed: boolean
  reason?: 'tenant_quota_not_configured' | 'provider_requests_limit' | 'request_chars_limit'
  blockedPolicy?: TutorUsagePolicyEvaluation
  policies: TutorUsagePolicyEvaluation[]
}

export function tutorQuotaWindowStart(period: TutorQuotaPeriod, now = new Date()): string {
  const date = new Date(now)
  if (period === 'month') {
    date.setUTCDate(1)
    date.setUTCHours(0, 0, 0, 0)
  } else {
    date.setUTCHours(0, 0, 0, 0)
  }
  return date.toISOString()
}

export function decideTutorQuota(
  evaluations: TutorUsagePolicyEvaluation[],
  projectedRequestChars: number,
): TutorQuotaDecision {
  const tenantPolicies = evaluations.filter((item) => item.policy.scope_type === 'tenant')
  if (!tenantPolicies.length) {
    return { allowed: false, reason: 'tenant_quota_not_configured', policies: evaluations }
  }

  for (const item of evaluations) {
    const requestLimit = item.policy.max_provider_requests
    if (requestLimit != null && item.usage.providerRequests + 1 > requestLimit) {
      return {
        allowed: false,
        reason: 'provider_requests_limit',
        blockedPolicy: item,
        policies: evaluations,
      }
    }

    const charLimit = item.policy.max_request_chars
    if (charLimit != null && item.usage.requestChars + Math.max(0, projectedRequestChars) > charLimit) {
      return {
        allowed: false,
        reason: 'request_chars_limit',
        blockedPolicy: item,
        policies: evaluations,
      }
    }
  }

  return { allowed: true, policies: evaluations }
}

function policyFilterSql(policy: TutorUsagePolicyRow): { sql: string; bindings: string[] } {
  if (policy.scope_type === 'course') return { sql: ' AND course_id=?', bindings: [String(policy.scope_id ?? '')] }
  if (policy.scope_type === 'student') return { sql: ' AND student_id=?', bindings: [String(policy.scope_id ?? '')] }
  return { sql: '', bindings: [] }
}

export async function tutorUsageForPolicy(db: any, policy: TutorUsagePolicyRow, now = new Date()): Promise<TutorUsagePolicyEvaluation> {
  const windowStartedAt = tutorQuotaWindowStart(policy.period, now)
  const filter = policyFilterSql(policy)
  const row = await db.prepare(`
    SELECT
      COUNT(*) AS provider_requests,
      COALESCE(SUM(request_chars),0) AS request_chars
    FROM academy_tutor_provider_events
    WHERE tenant_id=?
      AND created_at>=?
      AND outcome<>'config_error'
      ${filter.sql}
  `).bind(policy.tenant_id, windowStartedAt, ...filter.bindings).first()

  return {
    policy,
    usage: {
      providerRequests: Number(row?.provider_requests ?? 0),
      requestChars: Number(row?.request_chars ?? 0),
    },
    windowStartedAt,
  }
}

export async function loadApplicableTutorUsagePolicies(
  db: any,
  input: { tenantId: string; courseId: string; studentId: string },
  now = new Date(),
): Promise<TutorUsagePolicyEvaluation[]> {
  const rows = await db.prepare(`
    SELECT id, tenant_id, scope_type, scope_id, period, version,
           max_provider_requests, max_request_chars, status, rationale,
           approved_by, approved_at, archived_at, created_at
    FROM academy_tutor_usage_policies
    WHERE tenant_id=? AND status='active' AND (
      scope_type='tenant'
      OR (scope_type='course' AND scope_id=?)
      OR (scope_type='student' AND scope_id=?)
    )
    ORDER BY CASE scope_type WHEN 'tenant' THEN 0 WHEN 'course' THEN 1 ELSE 2 END,
             CASE period WHEN 'month' THEN 0 ELSE 1 END,
             version DESC
  `).bind(input.tenantId, input.courseId, input.studentId).all()

  const evaluations: TutorUsagePolicyEvaluation[] = []
  for (const row of rows.results as TutorUsagePolicyRow[]) {
    evaluations.push(await tutorUsageForPolicy(db, row, now))
  }
  return evaluations
}

export async function evaluateTutorUsageQuota(
  db: any,
  input: { tenantId: string; courseId: string; studentId: string; projectedRequestChars: number },
  now = new Date(),
): Promise<TutorQuotaDecision> {
  const policies = await loadApplicableTutorUsagePolicies(db, input, now)
  return decideTutorQuota(policies, input.projectedRequestChars)
}
