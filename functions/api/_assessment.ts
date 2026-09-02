export interface PolicyQuestion {
  id: string
  type: 'multiple_choice' | 'true_false' | 'open_answer'
  points: number
  correctOptionIds?: string[]
  manualReview?: boolean
}

export interface SubmittedAnswer {
  questionId: string
  optionIds?: string[]
  answerText?: string
}

export interface AutomaticAssessmentResult {
  automaticPoints: number
  automaticTotalPoints: number
  totalPoints: number
  percentage: number | null
  needsManualReview: boolean
  pendingManualQuestionIds: string[]
}

const exactSet = (left: string[] = [], right: string[] = []) => {
  const a = [...left].sort()
  const b = [...right].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function scoreAssessment(
  questions: PolicyQuestion[],
  answers: SubmittedAnswer[],
): AutomaticAssessmentResult {
  let automaticPoints = 0
  let automaticTotalPoints = 0
  let totalPoints = 0
  const pendingManualQuestionIds: string[] = []

  for (const question of questions) {
    const points = Math.max(0, Number(question.points) || 0)
    totalPoints += points

    const requiresManual = question.manualReview === true || question.type === 'open_answer'
    if (requiresManual) {
      pendingManualQuestionIds.push(question.id)
      continue
    }

    automaticTotalPoints += points
    const answer = answers.find((item) => item.questionId === question.id)
    if (exactSet(answer?.optionIds, question.correctOptionIds)) automaticPoints += points
  }

  const needsManualReview = pendingManualQuestionIds.length > 0
  const percentage = needsManualReview
    ? null
    : totalPoints > 0
      ? Math.round((automaticPoints / totalPoints) * 10000) / 100
      : 0

  return {
    automaticPoints,
    automaticTotalPoints,
    totalPoints,
    percentage,
    needsManualReview,
    pendingManualQuestionIds,
  }
}

export function resolveAutomaticStatus(
  result: AutomaticAssessmentResult,
  minimumScore: number,
): 'manual_review' | 'approved' | 'failed' {
  if (result.needsManualReview) return 'manual_review'
  return Number(result.percentage ?? 0) >= minimumScore ? 'approved' : 'failed'
}
