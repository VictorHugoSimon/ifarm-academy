import { scoreQuiz } from './quizScoring'
import type { CertificateEligibility, CertificateEligibilityInput, QuizAttempt } from '../domain/assessment'
import type { QuizAnswer, QuizDefinition } from '../domain/quiz'

export function submitAttempt(
  quiz: QuizDefinition,
  attempt: QuizAttempt,
  answers: QuizAnswer[],
): QuizAttempt {
  const automaticResult = scoreQuiz(quiz, answers)
  const submittedAt = new Date().toISOString()

  return {
    ...attempt,
    answers,
    automaticResult,
    submittedAt,
    status: automaticResult.needsManualReview
      ? 'manual_review'
      : automaticResult.passed
        ? 'approved'
        : 'failed',
    finalPercentage: automaticResult.needsManualReview
      ? undefined
      : automaticResult.percentage,
  }
}

export function applyManualReview(
  quiz: QuizDefinition,
  attempt: QuizAttempt,
  manualPoints: number,
  manualTotalPoints: number,
  reviewerName: string,
  reviewNote = '',
): QuizAttempt {
  if (!attempt.automaticResult) {
    throw new Error('Tentativa precisa ser submetida antes da revisão manual.')
  }

  const safePoints = Math.max(0, Math.min(manualPoints, manualTotalPoints))
  const earned = attempt.automaticResult.automaticPoints + safePoints
  const possible = attempt.automaticResult.totalAutomaticPoints + Math.max(0, manualTotalPoints)
  const finalPercentage = possible ? Math.round((earned / possible) * 10000) / 100 : 0

  return {
    ...attempt,
    manualPoints: safePoints,
    manualTotalPoints,
    finalPercentage,
    status: finalPercentage >= quiz.minimumScore ? 'approved' : 'failed',
    reviewedAt: new Date().toISOString(),
    reviewerName,
    reviewNote,
  }
}

export function evaluateCertificateEligibility(
  input: CertificateEligibilityInput,
): CertificateEligibility {
  const reasons: string[] = []

  if (input.courseProgressPercent < 100) {
    reasons.push('Conclua todas as aulas obrigatórias do curso.')
  }

  if (input.quizRequired) {
    if (!input.attempt) {
      reasons.push('Realize a avaliação obrigatória.')
    } else if (input.attempt.status === 'manual_review') {
      reasons.push('A avaliação está aguardando revisão manual.')
    } else if (input.attempt.status !== 'approved') {
      reasons.push('Atinga a nota mínima da avaliação.')
    } else if ((input.attempt.finalPercentage ?? 0) < input.minimumScore) {
      reasons.push('A nota final ainda está abaixo da nota mínima.')
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    finalScore: input.attempt?.finalPercentage,
  }
}

export function nextAttemptNumber(attempts: QuizAttempt[]): number {
  return attempts.length + 1
}
