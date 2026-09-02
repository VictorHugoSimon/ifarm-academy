import type { CertificateRecord, QuizAttempt } from '../domain/assessment'

export interface LessonProgressRecord {
  studentId: string
  courseId: string
  lessonId: string
  progressPercent: number
  completedAt?: string
  updatedAt: string
}

export interface ProgressRepository {
  list(studentId: string, courseId: string): Promise<LessonProgressRecord[]>
  save(record: LessonProgressRecord): Promise<LessonProgressRecord>
}

export interface AttemptRepository {
  list(quizId: string, studentId: string): Promise<QuizAttempt[]>
  save(attempt: QuizAttempt): Promise<QuizAttempt>
}

export interface CertificateRepository {
  list(studentId: string, courseId: string): Promise<CertificateRecord[]>
  issue(input: Omit<CertificateRecord, 'id' | 'publicCode' | 'issuedAt' | 'status'>): Promise<CertificateRecord>
}

export interface AcademyPersistence {
  progress: ProgressRepository
  attempts: AttemptRepository
  certificates: CertificateRepository
}
