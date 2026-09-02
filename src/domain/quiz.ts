export type QuizQuestionType = 'multiple_choice' | 'true_false' | 'open_answer'

export interface QuizOption {
  id: string
  label: string
  isCorrect: boolean
  position: number
}

export interface QuizQuestion {
  id: string
  type: QuizQuestionType
  prompt: string
  explanation?: string
  points: number
  position: number
  required: boolean
  options: QuizOption[]
}

export interface QuizDefinition {
  id: string
  courseId: string
  title: string
  description?: string
  minimumScore: number
  attemptsAllowed: number
  randomizeQuestions: boolean
  showResultImmediately: boolean
  status: 'draft' | 'published'
  questions: QuizQuestion[]
}

export interface QuizAnswer {
  questionId: string
  optionIds?: string[]
  answerText?: string
}

export interface QuizAttemptResult {
  automaticPoints: number
  totalAutomaticPoints: number
  percentage: number
  passed: boolean
  needsManualReview: boolean
}
