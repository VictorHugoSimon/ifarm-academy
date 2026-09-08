import { authenticatedJson } from './authenticatedFetch'

export interface TutorCitation {
  moduleId: string
  moduleTitle: string
  lessonId: string
  lessonTitle: string
  contentType: string
  excerpt: string
}

export interface TutorSessionSummary {
  id: string
  courseId: string
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
  lastMessageAt: string
}

export interface TutorMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  responseMode: 'evidence_only' | 'provider'
  citations: TutorCitation[]
  createdAt: string
}

export interface TutorAnswer {
  sessionId: string
  courseId: string
  courseTitle: string
  responseMode: 'evidence_only'
  answer: string
  citations: TutorCitation[]
  insufficientEvidence: boolean
  messageId: string
  createdAt: string
}

export async function loadTutorSessions(courseId: string): Promise<TutorSessionSummary[]> {
  const result = await authenticatedJson<{ data: TutorSessionSummary[] }>(
    `/api/tutor?courseId=${encodeURIComponent(courseId)}`,
  )
  return result.data
}

export async function loadTutorHistory(sessionId: string): Promise<{ session: TutorSessionSummary; messages: TutorMessage[] }> {
  const result = await authenticatedJson<{ data: { session: TutorSessionSummary; messages: TutorMessage[] } }>(
    `/api/tutor?sessionId=${encodeURIComponent(sessionId)}`,
  )
  return result.data
}

export async function askTutor(input: { courseId: string; question: string; sessionId?: string | null }): Promise<TutorAnswer> {
  const result = await authenticatedJson<{ data: TutorAnswer }>('/api/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      courseId: input.courseId,
      question: input.question,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    }),
  })
  return result.data
}
