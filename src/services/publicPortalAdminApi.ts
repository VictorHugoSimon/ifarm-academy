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

export interface InstructorPublicProfileAdmin {
  instructorId: string
  displayName: string
  instructorStatus: 'active'|'inactive'
  configured: boolean
  slug?: string | null
  visibility: 'hidden'|'public'
  headline?: string | null
  shortBio?: string | null
  photoRef?: string | null
  specialties: string[]
  credentialSummary?: string | null
  featured: boolean
  seoTitle?: string | null
  seoDescription?: string | null
  updatedAt?: string | null
}

export interface PublicLearningPathAdmin {
  id: string
  slug: string
  title: string
  shortDescription?: string | null
  description: string
  category?: string | null
  coverRef?: string | null
  visibility: 'hidden'|'public'
  featured: boolean
  accessModel: PublicCourseProfileAdmin['accessModel']
  listPriceCents?: number | null
  currency: string
  seoTitle?: string | null
  seoDescription?: string | null
  courses: Array<{ courseId: string; title: string; position: number; academicStatus: string; publicVisibility: string }>
  createdAt: string
  updatedAt: string
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
  accessModel: PublicCourseProfileAdmin['accessModel']
  listPriceCents?: number | null
  featured: boolean
  seoTitle?: string | null
  seoDescription?: string | null
}) {
  return request('/api/public-course-profiles', { method: 'PUT', body: JSON.stringify(input) })
}

export async function loadInstructorPublicProfiles(): Promise<InstructorPublicProfileAdmin[]> {
  return (await request<{ data: InstructorPublicProfileAdmin[] }>('/api/instructor-public-profiles')).data
}

export async function saveInstructorPublicProfile(input: {
  instructorId: string
  slug: string
  visibility: 'hidden'|'public'
  headline?: string | null
  shortBio?: string | null
  photoRef?: string | null
  specialties: string[]
  credentialSummary?: string | null
  featured: boolean
  seoTitle?: string | null
  seoDescription?: string | null
}) {
  return request('/api/instructor-public-profiles', { method: 'PUT', body: JSON.stringify(input) })
}

export async function loadPublicLearningPaths(): Promise<PublicLearningPathAdmin[]> {
  return (await request<{ data: PublicLearningPathAdmin[] }>('/api/public-learning-paths')).data
}

export async function createPublicLearningPath(input: {
  title: string; slug: string; shortDescription?: string | null; description?: string; category?: string | null; coverRef?: string | null;
  visibility: 'hidden'|'public'; featured: boolean; accessModel: PublicCourseProfileAdmin['accessModel']; listPriceCents?: number | null; currency?: string;
  seoTitle?: string | null; seoDescription?: string | null; courseIds: string[]
}) {
  return request('/api/public-learning-paths', { method: 'POST', body: JSON.stringify(input) })
}

export async function savePublicLearningPath(input: {
  pathId: string; title: string; slug: string; shortDescription?: string | null; description?: string; category?: string | null; coverRef?: string | null;
  visibility: 'hidden'|'public'; featured: boolean; accessModel: PublicCourseProfileAdmin['accessModel']; listPriceCents?: number | null; currency?: string;
  seoTitle?: string | null; seoDescription?: string | null; courseIds: string[]
}) {
  return request('/api/public-learning-paths', { method: 'PUT', body: JSON.stringify(input) })
}
