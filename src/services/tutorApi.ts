import { authenticatedJson } from './authenticatedFetch'

export interface TutorSessionSummary {
  id: string
  course_id: string
  title: string
  status: 'active' | 'closed'
  created_at: string
  updated_at: string
}

export interface TutorCitation {
  chunkId: string
  lessonId: string
  lessonTitle: string
  sourceType: 'lesson_body' | 'lesson_instructions'
  excerpt: string
  score: number
}

export type TutorProviderBlockedReason =
  | 'prompt_risk'
  | 'tenant_quota_not_configured'
  | 'provider_requests_limit'
  | 'request_chars_limit'
  | 'quota_concurrency_block'

export interface TutorAnswer {
  sessionId: string
  courseId: string
  courseTitle: string
  mode: 'evidence_only' | 'insufficient_context' | 'provider_generated'
  answer: string
  citations: TutorCitation[]
  providerConfigured: boolean
  providerMode: 'disabled' | 'gateway_v1'
  providerAttempted: boolean
  providerOutcome?: 'success' | 'config_error' | 'timeout' | 'network_error' | 'provider_error' | 'invalid_response' | null
  providerBlockedReason?: TutorProviderBlockedReason | null
  generativeAuthorized: boolean
  externalGenerationRequested: boolean
  fallbackUsed: boolean
}

export interface TutorPolicyStatus {
  courseId: string
  courseTitle: string
  courseStatus: 'draft' | 'review' | 'published' | 'archived'
  enabled: boolean
  approvedBy?: string | null
  approvedAt?: string | null
  disabledAt?: string | null
  lastIndexedAt?: string | null
  lastIndexedCourseUpdatedAt?: string | null
  chunkCount: number
  generativeEnabled: boolean
  generativeApprovedBy?: string | null
  generativeApprovedAt?: string | null
  generativeApprovedCourseUpdatedAt?: string | null
  generativeDisabledAt?: string | null
  generationMatchesCurrentCourse: boolean
  providerRuntime: {
    mode: 'disabled' | 'gateway_v1'
    configured: boolean
    reason?: string
    timeoutMs: number
    maxOutputChars: number
  }
}

export type TutorQuotaScope = 'tenant' | 'course' | 'student'
export type TutorQuotaPeriod = 'day' | 'month'

export interface TutorUsagePolicy {
  id: string
  scopeType: TutorQuotaScope
  scopeId?: string | null
  period: TutorQuotaPeriod
  version: number
  maxProviderRequests?: number | null
  maxRequestChars?: number | null
  status: 'active' | 'archived'
  rationale: string
  approvedBy: string
  approvedAt: string
  archivedAt?: string | null
  createdAt: string
}

export interface TutorUsagePolicyEvaluation {
  policy: TutorUsagePolicy
  usage: {
    providerRequests: number
    requestChars: number
  }
  windowStartedAt: string
}

export interface TutorOperations {
  period: { days: number; since: string }
  providerRuntime: TutorPolicyStatus['providerRuntime']
  metrics: {
    totalProviderEvents: number
    attemptedCalls: number
    successfulCalls: number
    successRate: number
    averageLatencyMs: number
    requestChars: number
    responseChars: number
    quotaBlocks: number
    promptRisks: number
  }
  outcomes: Array<{ outcome: string; total: number }>
  guardrails: Array<{ event_type: 'prompt_risk' | 'quota_block'; reason_code: string; total: number }>
  activePolicies: TutorUsagePolicyEvaluation[]
  courses: Array<{ course_id: string; title: string; total: number; success: number }>
}

function normalizeUsagePolicy(row: Record<string, any>): TutorUsagePolicy {
  return {
    id: String(row.id),
    scopeType: String(row.scopeType ?? row.scope_type) as TutorQuotaScope,
    scopeId: row.scopeId ?? row.scope_id ?? null,
    period: String(row.period) as TutorQuotaPeriod,
    version: Number(row.version ?? 1),
    maxProviderRequests: row.maxProviderRequests ?? row.max_provider_requests ?? null,
    maxRequestChars: row.maxRequestChars ?? row.max_request_chars ?? null,
    status: String(row.status) as TutorUsagePolicy['status'],
    rationale: String(row.rationale ?? ''),
    approvedBy: String(row.approvedBy ?? row.approved_by ?? ''),
    approvedAt: String(row.approvedAt ?? row.approved_at ?? ''),
    archivedAt: row.archivedAt ?? row.archived_at ?? null,
    createdAt: String(row.createdAt ?? row.created_at ?? ''),
  }
}

export async function loadTutorSessions(): Promise<TutorSessionSummary[]> {
  const result = await authenticatedJson<{ data: TutorSessionSummary[] }>('/api/tutor')
  return result.data
}

export async function askTutor(input: {
  courseId: string
  question: string
  sessionId?: string
  allowExternalGeneration?: boolean
}): Promise<TutorAnswer> {
  const result = await authenticatedJson<{ data: TutorAnswer }>('/api/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.data
}

export async function loadTutorPolicy(courseId: string): Promise<TutorPolicyStatus> {
  const result = await authenticatedJson<{ data: TutorPolicyStatus }>(
    `/api/tutor-policy?courseId=${encodeURIComponent(courseId)}`,
  )
  return result.data
}

export async function setTutorPolicy(courseId: string, enabled: boolean) {
  const result = await authenticatedJson<{ data: Record<string, unknown> }>('/api/tutor-policy', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ courseId, enabled }),
  })
  return result.data
}

export async function setTutorGenerationPolicy(courseId: string, enabled: boolean) {
  const result = await authenticatedJson<{ data: Record<string, unknown> }>('/api/tutor-generation-policy', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ courseId, enabled }),
  })
  return result.data
}

export async function rebuildTutorSources(courseId: string) {
  const result = await authenticatedJson<{ data: {
    courseId: string
    courseTitle: string
    lessonCount: number
    chunkCount: number
    indexedAt: string
  } }>('/api/tutor-sources', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ courseId }),
  })
  return result.data
}

export async function loadTutorUsagePolicies(): Promise<TutorUsagePolicy[]> {
  const result = await authenticatedJson<{ data: Array<Record<string, any>> }>('/api/tutor-usage-policies')
  return result.data.map(normalizeUsagePolicy)
}

export async function saveTutorUsagePolicy(input: {
  scopeType: TutorQuotaScope
  scopeId?: string
  period: TutorQuotaPeriod
  maxProviderRequests?: number | null
  maxRequestChars?: number | null
  rationale: string
}): Promise<TutorUsagePolicy> {
  const result = await authenticatedJson<{ data: Record<string, any> }>('/api/tutor-usage-policies', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return normalizeUsagePolicy(result.data)
}

export async function archiveTutorUsagePolicy(id: string) {
  return authenticatedJson<{ data: { id: string; status: 'archived'; archivedAt?: string }; idempotent?: boolean }>(
    `/api/tutor-usage-policies?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}

export async function loadTutorOperations(days = 7): Promise<TutorOperations> {
  const result = await authenticatedJson<{ data: Omit<TutorOperations, 'activePolicies'> & { activePolicies: Array<{
    policy: Record<string, any>
    usage: { providerRequests: number; requestChars: number }
    windowStartedAt: string
  }> } }>(`/api/tutor-operations?days=${encodeURIComponent(String(days))}`)

  return {
    ...result.data,
    activePolicies: result.data.activePolicies.map((item) => ({
      ...item,
      policy: normalizeUsagePolicy(item.policy),
    })),
  }
}
