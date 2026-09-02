import type { CertificateRecord, QuizAttempt } from '../domain/assessment'

const ATTEMPTS_KEY = 'ifarm-academy:quiz-attempts:v08'
const CERTIFICATES_KEY = 'ifarm-academy:certificates:v08'

export function loadAttempts(quizId?: string, studentId?: string): QuizAttempt[] {
  const raw = localStorage.getItem(ATTEMPTS_KEY)
  if (!raw) return []

  try {
    const items = JSON.parse(raw) as QuizAttempt[]
    return items.filter((item) =>
      (!quizId || item.quizId === quizId) &&
      (!studentId || item.studentId === studentId),
    )
  } catch {
    return []
  }
}

export function saveAttempt(attempt: QuizAttempt): QuizAttempt {
  const all = loadAttempts()
  const index = all.findIndex((item) => item.id === attempt.id)
  const next = index >= 0
    ? all.map((item) => item.id === attempt.id ? attempt : item)
    : [attempt, ...all]

  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next))
  return attempt
}

export function createAttempt(quizId: string, studentId: string): QuizAttempt {
  const previous = loadAttempts(quizId, studentId)
  const attempt: QuizAttempt = {
    id: crypto.randomUUID(),
    quizId,
    studentId,
    attemptNumber: previous.length + 1,
    status: 'in_progress',
    answers: [],
    startedAt: new Date().toISOString(),
  }
  return saveAttempt(attempt)
}

export function loadCertificates(studentId?: string, courseId?: string): CertificateRecord[] {
  const raw = localStorage.getItem(CERTIFICATES_KEY)
  if (!raw) return []

  try {
    const items = JSON.parse(raw) as CertificateRecord[]
    return items.filter((item) =>
      (!studentId || item.studentId === studentId) &&
      (!courseId || item.courseId === courseId),
    )
  } catch {
    return []
  }
}

export function issueCertificate(input: Omit<CertificateRecord, 'id' | 'publicCode' | 'issuedAt' | 'status'>): CertificateRecord {
  const existing = loadCertificates(input.studentId, input.courseId)
    .find((item) => item.status === 'valid')
  if (existing) return existing

  const now = new Date()
  const serial = `${now.getFullYear()}-${String(now.getTime()).slice(-6)}`
  const certificate: CertificateRecord = {
    ...input,
    id: crypto.randomUUID(),
    publicCode: `IFA-${serial}`,
    issuedAt: now.toISOString(),
    status: 'valid',
  }

  const all = loadCertificates()
  localStorage.setItem(CERTIFICATES_KEY, JSON.stringify([certificate, ...all]))
  return certificate
}
