import { loadCatalog, type CatalogCourse } from './enrollmentApi'

export interface CompanyRecord {
  id: string
  name: string
  documentLabel?: string | null
  status: 'active' | 'inactive'
  activeMembers: number
  assignments: number
  createdAt: string
  updatedAt: string
}

export interface CompanyMemberRecord {
  id: string
  companyId: string
  userId: string
  displayName: string
  employeeCode?: string | null
  jobTitle?: string | null
  status: 'active' | 'inactive'
  assignments: number
  completedAssignments: number
  createdAt: string
  updatedAt: string
}

export interface CompanyAssignmentRecord {
  id: string
  companyId: string
  memberId: string
  userId: string
  displayName: string
  employeeCode?: string | null
  jobTitle?: string | null
  courseId: string
  courseTitle: string
  required: boolean
  dueAt?: string | null
  status: 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  effectiveStatus: 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  progressPercent?: number
  overdue: boolean
  certificateCode?: string | null
  certificateStatus?: string | null
  assignedAt: string
  completedAt?: string | null
  updatedAt: string
}

export interface CompanyTrainingSummary {
  company: { id: string; name: string; status: string }
  activeMembers: number
  assignments: number
  requiredAssignments: number
  completedAssignments: number
  overdueAssignments: number
  validCertificates: number
  completionPercent: number
}

export interface CompanyLearningPathCourse {
  id?: string
  courseId: string
  courseTitle?: string
  courseStatus?: string
  required: boolean
  renewalMonths?: number | null
  position?: number
}

export interface CompanyLearningPathRecord {
  id: string
  companyId: string
  name: string
  description: string
  status: 'active' | 'inactive'
  defaultRenewalMonths?: number | null
  assignments: number
  courses: CompanyLearningPathCourse[]
  createdAt: string
  updatedAt: string
}

export interface CompanyPathAssignmentRecord {
  id: string
  companyId: string
  pathId: string
  pathName: string
  memberId: string
  userId: string
  displayName: string
  jobTitle?: string | null
  status: 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  effectiveStatus: 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  dueAt?: string | null
  overdue: boolean
  progressPercent: number
  completedCourses: number
  requiredCourses: number
  courses: Array<{
    courseId: string
    courseTitle: string
    required: boolean
    renewalMonths?: number | null
    progressPercent: number
    completed: boolean
  }>
  assignedAt: string
}

export type CompanyRenewalState = 'due' | 'upcoming' | 'not_due'

export interface CompanyRenewalRecord {
  assignmentId: string
  companyId: string
  memberId: string
  userId: string
  displayName: string
  employeeCode?: string | null
  jobTitle?: string | null
  courseId: string
  courseTitle: string
  completedAt: string
  renewalMonths: number
  renewalCycle: number
  renewalState: CompanyRenewalState
  renewalDueAt: string
  daysRemaining: number
  certificateCode?: string | null
  certificateStatus?: string | null
  source: string
}

export interface CompanyRenewalResponse {
  data: CompanyRenewalRecord[]
  summary: { configured: number; due: number; upcoming: number; notDue: number }
  policy: { upcomingWindowDays: number; note: string }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Academy API ${response.status}: ${text}`)
  }
  return response.json() as Promise<T>
}

export async function loadCompanies(): Promise<CompanyRecord[]> {
  return (await request<{ data: CompanyRecord[] }>('/api/companies')).data
}

export async function createCompany(input: { name: string; documentLabel?: string }) {
  return request<{ data: CompanyRecord }>('/api/companies', { method: 'POST', body: JSON.stringify(input) })
}

export async function loadCompanyMembers(companyId: string): Promise<CompanyMemberRecord[]> {
  return (await request<{ data: CompanyMemberRecord[] }>(`/api/companies/${encodeURIComponent(companyId)}/members`)).data
}

export async function addCompanyMember(companyId: string, input: { userId: string; displayName: string; employeeCode?: string; jobTitle?: string }) {
  return request<{ data: CompanyMemberRecord; reactivated?: boolean }>(`/api/companies/${encodeURIComponent(companyId)}/members`, { method: 'POST', body: JSON.stringify(input) })
}

export async function loadCompanyAssignments(companyId: string): Promise<CompanyAssignmentRecord[]> {
  return (await request<{ data: CompanyAssignmentRecord[] }>(`/api/company-assignments?companyId=${encodeURIComponent(companyId)}`)).data
}

export async function assignCompanyCourse(input: { companyId: string; memberId: string; courseId: string; required: boolean; dueAt?: string }) {
  return request<{ data: CompanyAssignmentRecord; idempotent?: boolean }>('/api/company-assignments', { method: 'POST', body: JSON.stringify(input) })
}

export async function cancelCompanyAssignment(assignmentId: string) {
  return request<{ data: { id: string; status: 'cancelled'; updatedAt?: string }; idempotent?: boolean }>(`/api/company-assignments?assignmentId=${encodeURIComponent(assignmentId)}`, { method: 'DELETE' })
}

export async function loadCompanyTrainingSummary(companyId: string): Promise<CompanyTrainingSummary> {
  return (await request<{ data: CompanyTrainingSummary }>(`/api/company-training-summary?companyId=${encodeURIComponent(companyId)}`)).data
}

export async function loadEnterpriseCatalog(): Promise<CatalogCourse[]> {
  return loadCatalog()
}

export async function loadCompanyLearningPaths(companyId: string): Promise<CompanyLearningPathRecord[]> {
  return (await request<{ data: CompanyLearningPathRecord[] }>(`/api/company-learning-paths?companyId=${encodeURIComponent(companyId)}`)).data
}

export async function createCompanyLearningPath(input: {
  companyId: string
  name: string
  description?: string
  defaultRenewalMonths?: number | null
  courses: Array<{ courseId: string; required: boolean; renewalMonths?: number | null }>
}) {
  return request<{ data: CompanyLearningPathRecord }>('/api/company-learning-paths', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function inactivateCompanyLearningPath(pathId: string) {
  return request<{ data: { id: string; status: 'inactive'; updatedAt?: string }; idempotent?: boolean }>(
    `/api/company-learning-paths?pathId=${encodeURIComponent(pathId)}`,
    { method: 'DELETE' },
  )
}

export async function loadCompanyPathAssignments(companyId: string): Promise<CompanyPathAssignmentRecord[]> {
  return (await request<{ data: CompanyPathAssignmentRecord[] }>(`/api/company-path-assignments?companyId=${encodeURIComponent(companyId)}`)).data
}

export async function assignCompanyLearningPath(input: { companyId: string; pathId: string; memberId: string; dueAt?: string }) {
  return request<{ data: CompanyPathAssignmentRecord; idempotent?: boolean }>('/api/company-path-assignments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function loadCompanyRenewals(companyId: string, state?: CompanyRenewalState): Promise<CompanyRenewalResponse> {
  const query = new URLSearchParams({ companyId })
  if (state) query.set('state', state)
  return request<CompanyRenewalResponse>(`/api/company-renewals?${query.toString()}`)
}
