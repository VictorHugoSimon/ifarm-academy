import type { ContentType } from './academy'

export interface LessonContentDraft {
  body?: string
  instructions?: string
  externalUrl?: string
  label?: string
  fileName?: string
  provider?: string
  providerRef?: string
  linkedQuizId?: string
}

export interface BuilderLesson {
  id: string
  title: string
  contentType: ContentType
  durationMinutes: number
  required: boolean
  position: number
  content: LessonContentDraft
}

export interface BuilderModule {
  id: string
  title: string
  description?: string
  position: number
  lessons: BuilderLesson[]
}

export interface CourseBuilderState {
  courseId: string
  title: string
  modules: BuilderModule[]
  quiz: {
    enabled: boolean
    minimumScore: number
    attemptsAllowed: number
  }
}
