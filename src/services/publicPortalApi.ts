export interface PublicBrand {
  brandName: string
  academyName: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  logoRef?: string | null
  whiteLabelConfigured: boolean
}

export interface PublicCourse {
  id: string
  slug: string
  title: string
  description: string
  category?: string | null
  levelLabel?: string | null
  audienceText?: string | null
  coverRef?: string | null
  instructorLabel?: string | null
  certificateType: string
  accessModel: 'not_configured'|'free'|'paid'|'sponsored'|'included'
  listPriceCents?: number | null
  currency: string
  featured: boolean
  workloadMinutes: number
  moduleCount: number
  lessonCount: number
  checkoutReady: false
}

export interface PublicCourseDetail extends PublicCourse {
  shortDescription?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  modules: Array<{ id: string; title: string; description: string; position: number; lessonCount: number; durationMinutes: number }>
  enrollmentRequiresAuthentication: true
}

export interface PublicEvent {
  id: string
  title: string
  description: string
  eventType: string
  modality: string
  accessModel: 'free'|'paid'|'sponsored'
  priceCents?: number | null
  currency: string
  startsAt: string
  endsAt: string
  timezone: string
  registrationDeadline?: string | null
  capacity?: number | null
  occupied: number
  waitlisted: number
  venueName?: string | null
  addressText?: string | null
  smartFarmExperience: boolean
  meetingUrl: null
  registrationRequiresAuthentication: true
  checkoutReady: boolean
}

export interface PublicInstructor {
  instructorId: string
  slug: string
  displayName: string
  headline?: string | null
  shortBio?: string | null
  photoRef?: string | null
  specialties: string[]
  credentialSummary?: string | null
  featured: boolean
  publicCourseCount: number
}

export interface PublicInstructorDetail extends PublicInstructor {
  seoTitle?: string | null
  seoDescription?: string | null
  courses: PublicCourse[]
}

export interface PublicLearningPath {
  id: string
  slug: string
  title: string
  shortDescription?: string | null
  description: string
  category?: string | null
  coverRef?: string | null
  featured: boolean
  accessModel: PublicCourse['accessModel']
  listPriceCents?: number | null
  currency: string
  courseCount: number
  workloadMinutes: number
  checkoutReady: false
}

export interface PublicLearningPathDetail extends PublicLearningPath {
  seoTitle?: string | null
  seoDescription?: string | null
  courses: Array<PublicCourse & { position: number }>
  enrollmentRequiresAuthentication: true
}

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error ?? `Academy API ${response.status}`)
  return payload as T
}

export async function loadPublicContext() {
  return (await request<{ data: { hostname: string; resolution: string; brand: PublicBrand; routes: Record<string,string> } }>('/api/public/context')).data
}

export async function loadPublicCatalog(params?: { q?: string; category?: string }) {
  const url = new URL('/api/public/catalog', window.location.origin)
  if (params?.q) url.searchParams.set('q', params.q)
  if (params?.category) url.searchParams.set('category', params.category)
  return request<{ brand: PublicBrand; data: PublicCourse[]; filters: { categories: string[] } }>(url.pathname + url.search)
}

export async function loadPublicCourse(slug: string) {
  return request<{ brand: PublicBrand; data: PublicCourseDetail }>(`/api/public/course/${encodeURIComponent(slug)}`)
}

export async function loadPublicEvents() {
  return request<{ brand: PublicBrand; data: PublicEvent[] }>('/api/public/events')
}

export async function loadPublicInstructors() {
  return request<{ brand: PublicBrand; data: PublicInstructor[] }>('/api/public/instructors')
}

export async function loadPublicInstructor(slug: string) {
  return request<{ brand: PublicBrand; data: PublicInstructorDetail }>(`/api/public/instructor/${encodeURIComponent(slug)}`)
}

export async function loadPublicPaths() {
  return request<{ brand: PublicBrand; data: PublicLearningPath[] }>('/api/public/paths')
}

export async function loadPublicPath(slug: string) {
  return request<{ brand: PublicBrand; data: PublicLearningPathDetail }>(`/api/public/path/${encodeURIComponent(slug)}`)
}

export function formatAccessPrice(item: Pick<PublicCourse,'accessModel'|'listPriceCents'|'currency'>) {
  if (item.accessModel === 'free') return 'Gratuito'
  if (item.accessModel === 'sponsored') return 'Patrocinado'
  if (item.accessModel === 'included') return 'Incluído no plano'
  if (item.accessModel === 'paid' && item.listPriceCents != null) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency || 'BRL' }).format(item.listPriceCents / 100)
  }
  return 'Condições em definição'
}

export const formatPublicPrice = formatAccessPrice
