export type ContentType =
  | 'video'
  | 'audio'
  | 'pdf'
  | 'presentation'
  | 'text'
  | 'file'
  | 'link'
  | 'quiz'
  | 'exercise'
  | 'practical_activity'
  | 'case_study'
  | 'simulation'
  | 'exam'

export interface AcademyModule {
  id: string
  courseId: string
  title: string
  description?: string | null
  position: number
}

export interface AcademyLesson {
  id: string
  moduleId: string
  title: string
  contentType: ContentType
  contentRef?: string | null
  bodyText?: string | null
  durationMinutes: number
  required: boolean
  position: number
}

export interface Enrollment {
  id: string
  tenantId?: string | null
  courseId: string
  studentUserId: string
  status: 'active' | 'completed' | 'cancelled'
  source?: string | null
  enrolledAt: string
  completedAt?: string | null
}
