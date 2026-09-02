import type { QuizDefinition } from '../domain/quiz'

interface PublishedPolicy {
  quizId: string
  courseId?: string | null
  status: 'published'
  version: number
  minimumScore: number
  attemptsAllowed: number | null
  randomizeQuestions: boolean
  publishedBy: string
  publishedAt: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

export async function loadPublishedPolicy(quizId: string) {
  return request<{ data: { current: Record<string, unknown> | null; history: Array<Record<string, unknown>> } }>(
    `/api/quiz-policies?quizId=${encodeURIComponent(quizId)}`,
  )
}

export async function publishQuizPolicy(quiz: QuizDefinition): Promise<PublishedPolicy> {
  const questions = quiz.questions.map((question) => ({
    id: question.id,
    type: question.type,
    points: question.points,
    correctOptionIds: question.type === 'open_answer'
      ? undefined
      : question.options.filter((option) => option.isCorrect).map((option) => option.id),
    manualReview: question.type === 'open_answer',
  }))

  const result = await request<{ data: PublishedPolicy }>('/api/quiz-policies', {
    method: 'POST',
    body: JSON.stringify({
      quizId: quiz.id,
      courseId: quiz.courseId,
      minimumScore: quiz.minimumScore,
      attemptsAllowed: quiz.attemptsAllowed,
      randomizeQuestions: quiz.randomizeQuestions,
      questions,
    }),
  })
  return result.data
}

export async function saveCompletionPolicy(input: {
  courseId: string
  courseTitle: string
  requiredLessonsCount: number
  assessmentRequired: boolean
  quizId?: string | null
  minimumScore?: number | null
}) {
  return request<{ data: Record<string, unknown> }>('/api/completion-policies', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
