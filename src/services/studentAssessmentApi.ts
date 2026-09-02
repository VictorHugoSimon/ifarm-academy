import type { QuizAnswer } from '../domain/quiz'

export interface StudentAssessmentQuestion {
  id: string
  type: 'multiple_choice' | 'true_false' | 'open_answer'
  prompt: string
  points: number
  manualReview: boolean
  options: Array<{ id: string; label: string }>
}

export interface StudentAssessmentDefinition {
  quizId: string
  courseId: string
  version: number
  minimumScore: number
  attemptsAllowed: number | null
  randomizeQuestions: boolean
  questions: StudentAssessmentQuestion[]
}

export interface ServerAttempt {
  id: string
  quizId: string
  attemptNumber: number
  status: 'in_progress' | 'submitted' | 'manual_review' | 'approved' | 'failed'
  answers: QuizAnswer[]
  finalPercentage?: number | null
  startedAt: string
  submittedAt?: string | null
  policyVersion?: number | null
}

export interface ServerAttemptSubmission {
  id: string
  status: ServerAttempt['status']
  finalPercentage?: number | null
  minimumScore: number
  policyVersion: number
  enrollmentCompletion?: unknown
  certificate?: unknown
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

export async function loadStudentAssessment(quizId: string): Promise<StudentAssessmentDefinition> {
  const result = await request<{ data: StudentAssessmentDefinition }>(
    `/api/assessment?quizId=${encodeURIComponent(quizId)}`,
  )
  return result.data
}

function normalizeAttempt(row: Record<string, any>): ServerAttempt {
  return {
    id: String(row.id),
    quizId: String(row.quizId ?? row.quiz_id),
    attemptNumber: Number(row.attemptNumber ?? row.attempt_number ?? 1),
    status: String(row.status) as ServerAttempt['status'],
    answers: Array.isArray(row.answers) ? row.answers : [],
    finalPercentage: row.finalPercentage ?? row.final_percentage ?? null,
    startedAt: String(row.startedAt ?? row.started_at ?? ''),
    submittedAt: row.submittedAt ?? row.submitted_at ?? null,
    policyVersion: row.policyVersion ?? row.policy_version ?? null,
  }
}

export async function loadServerAttempts(quizId: string): Promise<ServerAttempt[]> {
  const result = await request<{ data: Array<Record<string, any>> }>(
    `/api/attempts?quizId=${encodeURIComponent(quizId)}`,
  )
  return result.data.map(normalizeAttempt)
}

export async function startServerAttempt(quizId: string): Promise<ServerAttempt> {
  const result = await request<{ data: Record<string, any> }>('/api/attempts', {
    method: 'POST',
    body: JSON.stringify({ quizId }),
  })
  return normalizeAttempt(result.data)
}

export async function saveServerAttemptAnswers(attemptId: string, answers: QuizAnswer[]): Promise<void> {
  await request(`/api/attempts/${encodeURIComponent(attemptId)}`, {
    method: 'PUT',
    body: JSON.stringify({ answers }),
  })
}

export async function submitServerAttempt(attemptId: string, answers: QuizAnswer[]): Promise<ServerAttemptSubmission> {
  const result = await request<{ data: ServerAttemptSubmission }>(`/api/attempts/${encodeURIComponent(attemptId)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  })
  return result.data
}
