import type { CourseBuilderState } from '../domain/builder'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

export async function loadCourseBuilder(courseId: string): Promise<CourseBuilderState> {
  const result = await request<{ data: CourseBuilderState }>(
    `/api/course-builder?courseId=${encodeURIComponent(courseId)}`,
  )
  return result.data
}

export async function saveCourseBuilder(state: CourseBuilderState): Promise<CourseBuilderState> {
  const result = await request<{ data: CourseBuilderState; savedAt: string }>('/api/course-builder', {
    method: 'PUT',
    body: JSON.stringify(state),
  })
  return result.data
}
