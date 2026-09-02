export type QualificationType = 'degree' | 'technical' | 'council_registration' | 'certification' | 'experience' | 'other'
export type VerificationStatus = 'declared' | 'verified' | 'rejected' | 'expired'
export type CourseInstructorRole = 'author' | 'instructor' | 'reviewer' | 'technical_responsible'

export interface InstructorRecord {
  id: string
  userId: string
  displayName: string
  bio: string
  status: 'active' | 'inactive'
  qualifications: number
  verifiedQualifications: number
  activeCourseRoles: number
  createdAt: string
  updatedAt: string
}

export interface InstructorQualificationRecord {
  id: string
  instructorId: string
  qualificationType: QualificationType
  title: string
  institution?: string | null
  field?: string | null
  councilName?: string | null
  registrationNumber?: string | null
  registrationRegion?: string | null
  issuedAt?: string | null
  expiresAt?: string | null
  verificationStatus: VerificationStatus
  evidenceRef?: string | null
  verifiedBy?: string | null
  verifiedAt?: string | null
  verificationNote?: string | null
  createdAt: string
  updatedAt: string
}

export interface CourseSummaryRecord {
  id: string
  title: string
  status: string
  moduleCount: number
  lessonCount: number
  updatedAt: string
}

export interface CourseInstructorRoleRecord {
  id: string
  courseId: string
  courseTitle: string
  instructorId: string
  userId: string
  displayName: string
  role: CourseInstructorRole
  qualificationId?: string | null
  qualificationTitle?: string | null
  qualificationStatus?: VerificationStatus | null
  qualificationExpiresAt?: string | null
  suitabilityConfirmed: boolean
  suitabilityConfirmedBy?: string | null
  suitabilityConfirmedAt?: string | null
  suitabilityNote?: string | null
  status: 'active' | 'inactive'
  assignedBy: string
  createdAt: string
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

export async function loadInstructors(): Promise<InstructorRecord[]> {
  return (await request<{ data: InstructorRecord[] }>('/api/instructors')).data
}

export async function createInstructor(input: { userId: string; displayName: string; bio?: string }) {
  return request<{ data: InstructorRecord; idempotent?: boolean; reactivated?: boolean }>('/api/instructors', {
    method: 'POST', body: JSON.stringify(input),
  })
}

export async function loadInstructorQualifications(instructorId: string): Promise<InstructorQualificationRecord[]> {
  return (await request<{ data: InstructorQualificationRecord[] }>(`/api/instructor-qualifications?instructorId=${encodeURIComponent(instructorId)}`)).data
}

export async function createInstructorQualification(input: {
  instructorId: string
  qualificationType: QualificationType
  title: string
  institution?: string
  field?: string
  councilName?: string
  registrationNumber?: string
  registrationRegion?: string
  issuedAt?: string
  expiresAt?: string
  evidenceRef?: string
}) {
  return request<{ data: InstructorQualificationRecord }>('/api/instructor-qualifications', { method: 'POST', body: JSON.stringify(input) })
}

export async function verifyInstructorQualification(input: { qualificationId: string; verificationStatus: Exclude<VerificationStatus, 'declared'>; verificationNote?: string }) {
  return request<{ data: InstructorQualificationRecord }>('/api/instructor-qualifications', { method: 'PUT', body: JSON.stringify(input) })
}

export async function loadCourseSummaries(): Promise<CourseSummaryRecord[]> {
  return (await request<{ data: CourseSummaryRecord[] }>('/api/courses')).data
}

export async function loadCourseInstructorRoles(courseId?: string): Promise<CourseInstructorRoleRecord[]> {
  const suffix = courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''
  return (await request<{ data: CourseInstructorRoleRecord[] }>(`/api/course-instructors${suffix}`)).data
}

export async function assignCourseInstructor(input: {
  courseId: string
  instructorId: string
  role: CourseInstructorRole
  qualificationId?: string
  suitabilityConfirmed?: boolean
  suitabilityNote?: string
}) {
  return request<{ data: CourseInstructorRoleRecord; idempotent?: boolean }>('/api/course-instructors', { method: 'POST', body: JSON.stringify(input) })
}

export async function inactivateCourseInstructorRole(roleId: string) {
  return request<{ data: { id: string; status: 'inactive' }; idempotent?: boolean }>(`/api/course-instructors?roleId=${encodeURIComponent(roleId)}`, { method: 'DELETE' })
}
