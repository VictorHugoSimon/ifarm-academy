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
  quizId: string
  studentId: string
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

export async function loadReviewQueue(quizId?: string): Promise<ReviewQueueItem[]> {
  const query = quizId ? `?quizId=${encodeURIComponent(quizId)}` : ''
  const result = await api<{ data: ReviewQueueItem[] }>(`/api/reviews${query}`)
  return result.data
}

export async function submitManualReview(
  attemptId: string,
  input: {
    reviewerId: string
    reviewerName: string
    reviewNote?: string
    reviews: ManualQuestionReview[]
  },
) {
  return api<{ data: {
    id: string
    status: 'approved' | 'failed'
    finalPercentage: number
    manualPoints: number
    manualTotalPoints: number
    reviewedQuestionIds: string[]
    reviewerId: string
    reviewerName: string
    reviewedAt: string
  } }>(`/api/attempts/${encodeURIComponent(attemptId)}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
