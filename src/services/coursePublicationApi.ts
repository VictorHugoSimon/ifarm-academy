import { listCourses, type CourseSummary } from './courseBuilderApi'
import { authenticatedJson } from './authenticatedFetch'

export interface CourseReadinessResult {
  courseId: string
  status: 'draft' | 'review' | 'published' | 'archived'
  ready: boolean
  issues: string[]
  moduleCount: number
  lessonCount: number
  requiredLessonCount: number
  quizId?: string | null
}

function request<T>(url: string, init?: RequestInit): Promise<T> {
  return authenticatedJson<T>(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
}

export const loadPublicationCourses = (): Promise<CourseSummary[]> => listCourses()

export async function loadCourseReadiness(courseId: string): Promise<CourseReadinessResult> {
  const result = await request<{ data: CourseReadinessResult }>(
    `/api/course-publication?courseId=${encodeURIComponent(courseId)}`,
  )
  return result.data
}

export async function changeCoursePublication(
  courseId: string,
  action: 'submit_review' | 'publish' | 'return_draft' | 'archive',
) {
  return request<{ data: { courseId: string; previousStatus: string; status: string; ready: boolean; changedAt: string; changedBy: string } }>(
    '/api/course-publication',
    {
      method: 'POST',
      body: JSON.stringify({ courseId, action }),
    },
  )
}
