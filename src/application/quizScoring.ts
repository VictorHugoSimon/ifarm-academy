import type { QuizAnswer, QuizAttemptResult, QuizDefinition } from '../domain/quiz'

export function scoreQuiz(quiz: QuizDefinition, answers: QuizAnswer[]): QuizAttemptResult {
  let automaticPoints = 0
  let totalAutomaticPoints = 0
  let needsManualReview = false

  for (const question of quiz.questions) {
    if (question.type === 'open_answer') {
      needsManualReview = true
      continue
    }

    totalAutomaticPoints += question.points
    const answer = answers.find((item) => item.questionId === question.id)
    const submitted = [...(answer?.optionIds ?? [])].sort()
    const expected = question.options.filter((option) => option.isCorrect).map((option) => option.id).sort()
    const correct = submitted.length === expected.length && submitted.every((value, index) => value === expected[index])
    if (correct) automaticPoints += question.points
  }

  const percentage = totalAutomaticPoints
    ? Math.round((automaticPoints / totalAutomaticPoints) * 10000) / 100
    : 0

  return {
    automaticPoints,
    totalAutomaticPoints,
    percentage,
    passed: !needsManualReview && percentage >= quiz.minimumScore,
    needsManualReview,
  }
}

export function canStartAttempt(quiz: QuizDefinition, completedAttempts: number): boolean {
  return quiz.status === 'published' && completedAttempts < quiz.attemptsAllowed
}
