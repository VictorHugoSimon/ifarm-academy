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
