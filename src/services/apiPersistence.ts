import type { CertificateRecord, QuizAttempt } from '../domain/assessment'
import type {
  AcademyPersistence,
  CertificateRepository,
  LessonProgressRecord,
  ProgressRepository,
  AttemptRepository,
} from './persistenceContracts'

export interface ApiPersistenceOptions {
  baseUrl?: string
  fetcher?: typeof fetch
}

async function request<T>(fetcher: typeof fetch, url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

export function createApiPersistence(options: ApiPersistenceOptions = {}): AcademyPersistence {
  const baseUrl = (options.baseUrl ?? '/api').replace(/\/$/, '')
  const fetcher = options.fetcher ?? fetch

  const progress: ProgressRepository = {
    list: (studentId, courseId) => request(fetcher, `${baseUrl}/progress?studentId=${encodeURIComponent(studentId)}&courseId=${encodeURIComponent(courseId)}`),
    save: (record) => request(fetcher, `${baseUrl}/progress`, { method: 'PUT', body: JSON.stringify(record) }),
  }

  const attempts: AttemptRepository = {
    list: (quizId, studentId) => request(fetcher, `${baseUrl}/attempts?quizId=${encodeURIComponent(quizId)}&studentId=${encodeURIComponent(studentId)}`),
    save: (attempt: QuizAttempt) => request(fetcher, `${baseUrl}/attempts/${encodeURIComponent(attempt.id)}`, { method: 'PUT', body: JSON.stringify(attempt) }),
  }

  const certificates: CertificateRepository = {
    list: (studentId, courseId) => request(fetcher, `${baseUrl}/certificates?studentId=${encodeURIComponent(studentId)}&courseId=${encodeURIComponent(courseId)}`),
    issue: (input) => request(fetcher, `${baseUrl}/certificates`, { method: 'POST', body: JSON.stringify(input) }),
  }

  return { progress, attempts, certificates }
}
