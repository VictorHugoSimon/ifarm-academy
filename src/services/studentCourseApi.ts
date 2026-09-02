import type { LessonContentDraft } from '../domain/builder'

export interface StudentDeliveredLesson {
  id: string
  moduleId: string
  title: string
  contentType: string
  durationMinutes: number
  required: boolean
  position: number
  content: LessonContentDraft
  progressPercent: number
  lastPositionSeconds: number
  completedAt?: string | null
}

export interface StudentDeliveredModule {
  id: string
  title: string
  description: string
  position: number
  lessons: StudentDeliveredLesson[]
}

export interface StudentCourseDelivery {
  course: {
    id: string
    title: string
    description: string
    status: string
  }
  enrollment: {
    id: string
    status: 'active' | 'completed'
    activeCycleId: string
    cycleNumber?: number | null
    cycleStatus?: 'active' | 'completed' | 'cancelled' | null
    cycleSource?: string | null
    cycleStartedAt?: string | null
    cycleCompletedAt?: string | null
    cycleDueAt?: string | null
    enrolledAt: string
    completedAt?: string | null
  }
  modules: StudentDeliveredModule[]
  completion: {
    overallProgressPercent: number
    requiredLessons: number
    completedRequiredLessons: number
    assessmentRequired: boolean
    quizId?: string | null
    minimumScore?: number | null
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

export async function loadStudentCourse(courseId: string): Promise<StudentCourseDelivery> {
  const result = await request<{ data: StudentCourseDelivery }>(
    `/api/my-course?courseId=${encodeURIComponent(courseId)}`,
  )
  return result.data
}

export async function saveLessonProgress(input: {
  courseId: string
  lessonId: string
  progressPercent: number
  lastPositionSeconds?: number
}) {
  return request<{ data: {
    courseId: string
    cycleId: string
    cycleNumber?: number | null
    lessonId: string
    progressPercent: number
    lastPositionSeconds: number
    completedAt?: string | null
    enrollmentCompletion?: {
      completed: boolean
      newlyCompleted?: boolean
      cycleId?: string
      cycleNumber?: number
      completedAt?: string
      certificate?: unknown
      reason?: string
    }
  } }>('/api/progress', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
