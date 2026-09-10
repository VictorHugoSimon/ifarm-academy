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

export interface PublicPlanPrice {
  id: string
  billingInterval: 'monthly'|'annual'
  priceUnit: 'subscription'|'per_user'
  version: number
  amountCents: number
  currency: string
  validFrom?: string | null
  validUntil?: string | null
}

export interface PublicPlan {
  id: string
  slug: string
  name: string
  description: string
  audienceType: 'individual'|'corporate'|'partner'
  commercialMode: 'free'|'priced'|'contact_sales'
  featured: boolean
  maxUsers?: number | null
  seoTitle?: string | null
  seoDescription?: string | null
  prices: PublicPlanPrice[]
  courses: Array<{ id: string; slug: string; title: string; category?: string | null; coverRef?: string | null }>
  paths: Array<{ id: string; slug: string; title: string; shortDescription?: string | null; coverRef?: string | null }>
  externalBenefits: Array<{ sourceSystem: string; label: string; description: string }>
  checkoutReady: false
  subscriptionCreationReady: false
}

export type PublicSearchType = 'course'|'path'|'instructor'|'event'|'plan'

export interface PublicSearchItem {
  type: PublicSearchType
  id: string
  slug?: string | null
  title: string
  description: string
  category?: string | null
  level?: string | null
  accessModel?: string | null
  modality?: string | null
  startsAt?: string | null
  imageRef?: string | null
  featured: boolean
  href: string
  meta?: string[]
}

export interface PublicSearchFacets {
  types: Record<PublicSearchType, number>
  categories: Array<{ value: string; count: number }>
  accessModels: Array<{ value: string; count: number }>
  levels: Array<{ value: string; count: number }>
  modalities: Array<{ value: string; count: number }>
}

export interface PublicSearchResponse {
  brand: PublicBrand
  query: string
  filters: { types: PublicSearchType[]; category: string|null; access: string|null; level: string|null; modality: string|null }
  data: PublicSearchItem[]
  facets: PublicSearchFacets
  pagination: { limit: number; offset: number; total: number; hasMore: boolean }
  ranking: { behavioralPersonalization: false; commercialProfiling: false; strategy: string }
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

export async function loadPublicPlans() {
  return request<{ brand: PublicBrand; data: PublicPlan[] }>('/api/public/plans')
}

export async function loadPublicPlan(slug: string) {
  return request<{ brand: PublicBrand; data: PublicPlan }>(`/api/public/plan/${encodeURIComponent(slug)}`)
}

export async function loadPublicSearch(params: {
  q?: string
  types?: PublicSearchType[]
  category?: string
  access?: string
  level?: string
  modality?: string
  limit?: number
  offset?: number
} = {}) {
  const url = new URL('/api/public/search', window.location.origin)
  if (params.q?.trim()) url.searchParams.set('q', params.q.trim())
  if (params.types?.length) url.searchParams.set('types', params.types.join(','))
  if (params.category) url.searchParams.set('category', params.category)
  if (params.access) url.searchParams.set('access', params.access)
  if (params.level) url.searchParams.set('level', params.level)
  if (params.modality) url.searchParams.set('modality', params.modality)
  if (params.limit != null) url.searchParams.set('limit', String(params.limit))
  if (params.offset != null) url.searchParams.set('offset', String(params.offset))
  return request<PublicSearchResponse>(url.pathname + url.search)
}

export function formatPlanPrice(price: PublicPlanPrice) {
  const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: price.currency || 'BRL' }).format(price.amountCents / 100)
  const interval = price.billingInterval === 'annual' ? 'ano' : 'mês'
  return `${amount} / ${interval}${price.priceUnit === 'per_user' ? ' / usuário' : ''}`
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
