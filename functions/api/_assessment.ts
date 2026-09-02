export interface PolicyQuestionOption {
  id: string
  label: string
}

export interface PolicyQuestion {
  id: string
  type: 'multiple_choice' | 'true_false' | 'open_answer'
  prompt?: string
  points: number
  correctOptionIds?: string[]
  options?: PolicyQuestionOption[]
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

export interface ManualReviewItem {
  questionId: string
  awardedPoints: number
  note?: string
}

export interface ManualAssessmentResult {
  manualPoints: number
  manualTotalPoints: number
  finalPoints: number
  finalPercentage: number
  status: 'approved' | 'failed'
  reviewedQuestionIds: string[]
}

const exactSet = (left: string[] = [], right: string[] = []) => {
  const a = [...left].sort()
  const b = [...right].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function scoreAssessment(questions: PolicyQuestion[], answers: SubmittedAnswer[]): AutomaticAssessmentResult {
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
  const percentage = needsManualReview ? null : totalPoints > 0 ? Math.round((automaticPoints / totalPoints) * 10000) / 100 : 0
  return { automaticPoints, automaticTotalPoints, totalPoints, percentage, needsManualReview, pendingManualQuestionIds }
}

export function resolveAutomaticStatus(result: AutomaticAssessmentResult, minimumScore: number): 'manual_review' | 'approved' | 'failed' {
  if (result.needsManualReview) return 'manual_review'
  return Number(result.percentage ?? 0) >= minimumScore ? 'approved' : 'failed'
}

export function resolveManualReview(
  automaticResult: AutomaticAssessmentResult,
  questions: PolicyQuestion[],
  reviews: ManualReviewItem[],
  minimumScore: number,
): ManualAssessmentResult {
  const pendingIds = new Set(automaticResult.pendingManualQuestionIds)
  if (!pendingIds.size) throw new Error('Tentativa não possui questões pendentes de revisão manual')

  const reviewByQuestion = new Map<string, ManualReviewItem>()
  for (const review of reviews) {
    if (!pendingIds.has(review.questionId)) throw new Error(`Questão ${review.questionId} não está pendente de revisão manual`)
    if (reviewByQuestion.has(review.questionId)) throw new Error(`Questão ${review.questionId} foi revisada mais de uma vez`)
    reviewByQuestion.set(review.questionId, review)
  }

  for (const questionId of pendingIds) {
    if (!reviewByQuestion.has(questionId)) throw new Error(`Questão ${questionId} ainda não foi revisada`)
  }

  let manualPoints = 0
  let manualTotalPoints = 0
  for (const questionId of pendingIds) {
    const question = questions.find((item) => item.id === questionId)
    if (!question) throw new Error(`Questão ${questionId} não existe na política versionada`)
    const maxPoints = Math.max(0, Number(question.points) || 0)
    const awardedPoints = Number(reviewByQuestion.get(questionId)?.awardedPoints)
    if (!Number.isFinite(awardedPoints) || awardedPoints < 0 || awardedPoints > maxPoints) {
      throw new Error(`Pontuação da questão ${questionId} deve estar entre 0 e ${maxPoints}`)
    }
    manualPoints += awardedPoints
    manualTotalPoints += maxPoints
  }

  const finalPoints = automaticResult.automaticPoints + manualPoints
  const finalPercentage = automaticResult.totalPoints > 0
    ? Math.round((finalPoints / automaticResult.totalPoints) * 10000) / 100
    : 0
  const status = finalPercentage >= minimumScore ? 'approved' : 'failed'

  return {
    manualPoints,
    manualTotalPoints,
    finalPoints,
    finalPercentage,
    status,
    reviewedQuestionIds: [...pendingIds],
  }
}
