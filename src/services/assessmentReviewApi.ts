import type { QuizAnswer } from '../domain/quiz'

export interface ReviewQueueQuestion {
  id: string
  type: 'multiple_choice' | 'true_false' | 'open_answer'
  points: number
  prompt?: string
  manualReview?: boolean
}

export interface ReviewQueueItem {
  id: string
  tenantId: string
  quizId: string
  studentId: string
  studentName?: string | null
  attemptNumber: number
  status: 'manual_review'
  answers: QuizAnswer[]
  automaticResult: {
    automaticPoints: number
    automaticTotalPoints: number
    totalPoints: number
    percentage: number | null
    pendingManualQuestionIds: string[]
  } | null
  policyVersion: number | null
  minimumScore: number
  questions: ReviewQueueQuestion[]
  submittedAt?: string
  startedAt: string
}

export interface ReviewQueueFilters {
  quizId?: string
  studentId?: string
  submittedFrom?: string
  submittedTo?: string
  limit?: number
}

export interface ManualQuestionReview {
  questionId: string
  awardedPoints: number
  note?: string
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

export async function loadReviewQueue(filters: ReviewQueueFilters = {}): Promise<ReviewQueueItem[]> {
  const query = new URLSearchParams()
  if (filters.quizId?.trim()) query.set('quizId', filters.quizId.trim())
  if (filters.studentId?.trim()) query.set('studentId', filters.studentId.trim())
  if (filters.submittedFrom) query.set('submittedFrom', filters.submittedFrom)
  if (filters.submittedTo) query.set('submittedTo', filters.submittedTo)
  if (filters.limit) query.set('limit', String(filters.limit))

  const suffix = query.size ? `?${query.toString()}` : ''
  const result = await api<{ data: ReviewQueueItem[] }>(`/api/reviews${suffix}`)
  return result.data
}

export async function submitManualReview(
  attemptId: string,
  input: {
    reviewNote?: string
    reviews: ManualQuestionReview[]
  },
) {
  return api<{ data: {
    id: string
    tenantId: string
    status: 'approved' | 'failed'
    finalPercentage: number
    manualPoints: number
    manualTotalPoints: number
    reviewedQuestionIds: string[]
    reviewerId: string
    reviewerName: string
    reviewedAt: string
    certificate?: {
      issued: boolean
      idempotent?: boolean
      reason?: string
      certificate?: Record<string, unknown>
    } | null
  } }>(`/api/attempts/${encodeURIComponent(attemptId)}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
