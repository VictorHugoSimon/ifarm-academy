export type ValidityMode = 'indefinite' | 'fixed_months'

export interface CertificateValidityPolicy {
  id: string
  validityMode: ValidityMode
  validityMonths: number | null
  sourceReference: string
  note: string
  version: number
  confirmedBy: string
  confirmedAt: string
  updatedAt: string
}

export interface CertificateValidityCourse {
  courseId: string
  courseTitle: string
  courseStatus: string
  certificateType: 'free_course' | 'corporate_training' | 'regulatory_training' | 'partner_certification'
  policyConfigured: boolean
  policy: CertificateValidityPolicy | null
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error ?? `Academy API ${response.status}`)
  return payload as T
}

export async function loadCertificateValidityPolicies(): Promise<CertificateValidityCourse[]> {
  return (await request<{ data: CertificateValidityCourse[] }>('/api/certificate-validity-policies')).data
}

export async function saveCertificateValidityPolicy(input: {
  courseId: string
  validityMode: ValidityMode
  validityMonths?: number | null
  sourceReference: string
  note: string
  confirmed: boolean
}) {
  return request<{ data: {
    id: string
    courseId: string
    courseTitle: string
    certificateType: string
    validityMode: ValidityMode
    validityMonths: number | null
    sourceReference: string
    note: string
    version: number
    confirmedBy: string
    confirmedAt: string
    appliesTo: 'future_certificates_only'
  } }>('/api/certificate-validity-policies', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function removeCertificateValidityPolicy(courseId: string) {
  const query = new URLSearchParams({ courseId, confirmed: 'true' })
  return request<{ data: { courseId: string; policyConfigured: false; appliesTo?: string } }>(
    `/api/certificate-validity-policies?${query.toString()}`,
    { method: 'DELETE' },
  )
}
