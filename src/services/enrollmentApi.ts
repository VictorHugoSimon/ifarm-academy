export interface CatalogCourse {
  id: string
  title: string
  description: string
  moduleCount: number
  lessonCount: number
  requiredLessonCount: number
  assessmentRequired: boolean
  minimumScore: number
  updatedAt: string
}

export interface EnrollmentRecord {
  id: string
  tenantId: string
  courseId: string
  courseTitle: string
  courseStatus: string
  studentId: string
  studentName?: string | null
  source: string
  status: 'active' | 'completed' | 'cancelled'
  assessmentRequired: boolean
  minimumScore: number
  enrolledAt: string
  completedAt?: string | null
  updatedAt: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

export async function loadCatalog(): Promise<CatalogCourse[]> {
  const result = await request<{ data: CatalogCourse[] }>('/api/catalog')
  return result.data
}

export async function loadMyEnrollments(): Promise<EnrollmentRecord[]> {
  const result = await request<{ data: EnrollmentRecord[] }>('/api/enrollments')
  return result.data
}

export async function enroll(courseId: string) {
  return request<{ data: EnrollmentRecord; idempotent?: boolean; reactivated?: boolean }>('/api/enrollments', {
    method: 'POST',
    body: JSON.stringify({ courseId, source: 'academy_catalog' }),
  })
}

export async function cancelEnrollment(courseId: string) {
  return request<{ data: { id: string; courseId: string; status: 'cancelled'; updatedAt?: string }; idempotent?: boolean }>(
    `/api/enrollments?courseId=${encodeURIComponent(courseId)}`,
    { method: 'DELETE' },
  )
}
