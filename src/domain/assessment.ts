import type { QuizAnswer, QuizAttemptResult } from './quiz'

export type AttemptStatus =
  | 'in_progress'
  | 'submitted'
  | 'manual_review'
  | 'approved'
  | 'failed'

export interface QuizAttempt {
  id: string
  quizId: string
  studentId: string
  attemptNumber: number
  status: AttemptStatus
  answers: QuizAnswer[]
  automaticResult?: QuizAttemptResult
  manualPoints?: number
  manualTotalPoints?: number
  finalPercentage?: number
  startedAt: string
  submittedAt?: string
  reviewedAt?: string
  reviewerName?: string
  reviewNote?: string
}

export interface CertificateEligibilityInput {
  courseProgressPercent: number
  quizRequired: boolean
  attempt?: QuizAttempt
  minimumScore: number
}

export interface CertificateEligibility {
  eligible: boolean
  reasons: string[]
  finalScore?: number
}

export interface CertificateRecord {
  id: string
  publicCode: string
  studentId: string
  studentName: string
  courseId: string
  courseTitle: string
  finalScore?: number
  issuedAt: string
  status: 'valid' | 'revoked'
}
