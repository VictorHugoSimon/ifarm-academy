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
  mode: 'evidence_only' | 'insufficient_context'
  answer: string
  citations: TutorCitation[]
  providerConfigured: boolean
}

export async function loadTutorSessions(): Promise<TutorSessionSummary[]> {
  const result = await authenticatedJson<{ data: TutorSessionSummary[] }>('/api/tutor')
  return result.data
}

export async function askTutor(input: { courseId: string; question: string; sessionId?: string }): Promise<TutorAnswer> {
  const result = await authenticatedJson<{ data: TutorAnswer }>('/api/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
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
