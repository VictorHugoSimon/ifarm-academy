export type CertificateType = 'free_course' | 'corporate_training' | 'regulatory_training' | 'partner_certification'

export interface CertificateRecord {
  id?: string
  publicCode: string
  courseId?: string
  courseTitle: string
  studentName?: string
  finalScore?: number | null
  issuedAt: string
  status: 'valid' | 'revoked'
  workloadMinutes: number
  instructorLabel?: string | null
  certificateType: CertificateType
  completionDate: string
  metadataVersion: number
}

async function jsonRequest<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `Academy API ${response.status}`
    throw new Error(message)
  }
  return payload as T
}

export async function loadMyCertificates(): Promise<CertificateRecord[]> {
  const result = await jsonRequest<{ data: CertificateRecord[] }>('/api/my-certificates')
  return result.data
}

export async function validatePublicCertificate(code: string): Promise<{ valid: boolean; certificate: CertificateRecord }> {
  return jsonRequest<{ valid: boolean; certificate: CertificateRecord }>(
    `/api/certificates/public/${encodeURIComponent(code.trim().toUpperCase())}`,
  )
}

export function certificateValidationUrl(publicCode: string): string {
  const url = new URL('/certificates/validate', window.location.origin)
  url.searchParams.set('code', publicCode)
  return url.toString()
}

export function formatWorkload(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes || 0))
  const hours = Math.floor(safe / 60)
  const remaining = safe % 60
  if (hours && remaining) return `${hours}h ${remaining}min`
  if (hours) return `${hours}h`
  return `${remaining}min`
}
