import { authenticatedJson } from './authenticatedFetch'

export type TutorLearningSignalType =
  | 'course_completed'
  | 'continue_required_lessons'
  | 'assessment_ready'
  | 'assessment_in_progress'
  | 'manual_review_pending'
  | 'assessment_review_recommended'
  | 'assessment_approved_lessons_pending'

export interface TutorLearningSignal {
  type: TutorLearningSignalType
  tone: 'info' | 'attention' | 'success'
  title: string
  message: string
  recommendedLessonId?: string
  facts: Record<string, number | string | boolean | null>
}

export interface TutorLearningSignalsResult {
  courseId: string
  courseTitle: string
  cycleId: string
  cycleNumber: number
  cycleStatus: 'active' | 'completed' | 'cancelled'
  source: 'academic_state_only'
  generatedAt: string
  metrics: {
    requiredLessons: number
    completedRequiredLessons: number
    incompleteRequiredLessons: number
    failedAttempts: number
    latestAttemptStatus: string | null
    latestScore: number | null
  }
  signals: TutorLearningSignal[]
  privacy: {
    diagnostic: false
    commercialProfiling: false
    persistsProfile: false
    providerAttempted: false
  }
}

export async function loadTutorLearningSignals(courseId: string): Promise<TutorLearningSignalsResult> {
  const result = await authenticatedJson<{ data: TutorLearningSignalsResult }>(
    `/api/tutor-signals?courseId=${encodeURIComponent(courseId)}`,
  )
  return result.data
}
