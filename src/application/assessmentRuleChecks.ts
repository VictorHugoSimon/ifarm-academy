import { applyManualReview, evaluateCertificateEligibility, submitAttempt } from './assessmentService'
import type { QuizDefinition } from '../domain/quiz'
import type { QuizAttempt } from '../domain/assessment'

const quiz: QuizDefinition = {
  id: 'CHECK-QUIZ',
  courseId: 'CHECK-COURSE',
  title: 'Avaliação de validação',
  minimumScore: 70,
  attemptsAllowed: 3,
  randomizeQuestions: false,
  showResultImmediately: true,
  status: 'published',
  questions: [
    {
      id: 'Q1', type: 'true_false', prompt: 'Questão automática', points: 2,
      position: 1, required: true,
      options: [
        { id: 'T', label: 'Verdadeiro', isCorrect: true, position: 1 },
        { id: 'F', label: 'Falso', isCorrect: false, position: 2 },
      ],
    },
    {
      id: 'Q2', type: 'open_answer', prompt: 'Questão manual', points: 2,
      position: 2, required: true, options: [],
    },
  ],
}

function baseAttempt(): QuizAttempt {
  return {
    id: 'A1', quizId: quiz.id, studentId: 'S1', attemptNumber: 1,
    status: 'in_progress', answers: [], startedAt: '2026-09-02T00:00:00Z',
  }
}

export function runAssessmentRuleChecks() {
  const submitted = submitAttempt(quiz, baseAttempt(), [
    { questionId: 'Q1', optionIds: ['T'] },
    { questionId: 'Q2', answerText: 'Resposta para revisão.' },
  ])

  if (submitted.status !== 'manual_review') throw new Error('CHECK-01: resposta aberta deve exigir revisão manual')
  if (submitted.automaticResult?.percentage !== 100) throw new Error('CHECK-02: pontuação automática esperada = 100%')

  const reviewed = applyManualReview(quiz, submitted, 2, 2, 'Revisor')
  if (reviewed.status !== 'approved') throw new Error('CHECK-03: tentativa revisada deveria ser aprovada')
  if (reviewed.finalPercentage !== 100) throw new Error('CHECK-04: nota final esperada = 100%')

  const blockedByProgress = evaluateCertificateEligibility({
    courseProgressPercent: 80,
    quizRequired: true,
    attempt: reviewed,
    minimumScore: quiz.minimumScore,
  })
  if (blockedByProgress.eligible) throw new Error('CHECK-05: certificado deve bloquear progresso incompleto')

  const eligible = evaluateCertificateEligibility({
    courseProgressPercent: 100,
    quizRequired: true,
    attempt: reviewed,
    minimumScore: quiz.minimumScore,
  })
  if (!eligible.eligible) throw new Error('CHECK-06: certificado deveria estar elegível')

  return {
    passed: true,
    checks: 6,
    finalScore: reviewed.finalPercentage,
  }
}
