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
