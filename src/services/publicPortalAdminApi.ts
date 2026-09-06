export interface PublicCourseProfileAdmin {
  courseId: string
  courseTitle: string
  courseStatus: string
  courseDescription: string
  configured: boolean
  slug?: string | null
  category?: string | null
  levelLabel?: string | null
  shortDescription?: string | null
  audienceText?: string | null
  coverRef?: string | null
  visibility: 'hidden'|'public'
  accessModel: 'not_configured'|'free'|'paid'|'sponsored'|'included'
  listPriceCents?: number | null
  currency: string
  featured: boolean
  seoTitle?: string | null
  seoDescription?: string | null
  updatedAt?: string | null
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error ?? `Academy API ${response.status}`)
  return payload as T
}

export async function loadPublicCourseProfiles(): Promise<PublicCourseProfileAdmin[]> {
  return (await request<{ data: PublicCourseProfileAdmin[] }>('/api/public-course-profiles')).data
}

export async function savePublicCourseProfile(input: {
  courseId: string
  slug: string
  category?: string | null
  levelLabel?: string | null
  shortDescription?: string | null
  audienceText?: string | null
  coverRef?: string | null
  visibility: 'hidden'|'public'
  accessModel: 'not_configured'|'free'|'paid'|'sponsored'|'included'
  listPriceCents?: number | null
  featured: boolean
  seoTitle?: string | null
  seoDescription?: string | null
}) {
  return request('/api/public-course-profiles', { method: 'PUT', body: JSON.stringify(input) })
}
