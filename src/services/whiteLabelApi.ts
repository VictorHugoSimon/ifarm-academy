export type CatalogMode = 'all_tenant_courses' | 'selected_courses'

export interface WhiteLabelBrand {
  brandName: string
  academyName: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  logoRef?: string | null
  certificateHeading?: string | null
  catalogMode: CatalogMode
  whiteLabelConfigured?: boolean
  primaryDomain?: string | null
}

export interface WhiteLabelPermissions {
  canConfigure: boolean
  canVerifyDomains: boolean
}

export interface WhiteLabelDomain {
  id: string
  hostname: string
  status: 'pending' | 'verified' | 'disabled'
  isPrimary: boolean
  verificationReference?: string | null
  requestedAt: string
  verifiedAt?: string | null
}

export interface WhiteLabelCatalogCourse {
  id: string
  title: string
  status: string
  selected: boolean
  featured: boolean
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `Academy API ${response.status}`
    throw new Error(message)
  }
  return payload as T
}

export async function loadWhiteLabelPermissions(): Promise<WhiteLabelPermissions> {
  return (await request<{ data: WhiteLabelPermissions }>('/api/white-label-permissions')).data
}

export async function loadWhiteLabelSettings(): Promise<WhiteLabelBrand> {
  return (await request<{ data: WhiteLabelBrand }>('/api/white-label-settings')).data
}

export async function saveWhiteLabelSettings(input: WhiteLabelBrand): Promise<WhiteLabelBrand> {
  return (await request<{ data: WhiteLabelBrand }>('/api/white-label-settings', { method: 'PUT', body: JSON.stringify(input) })).data
}

export async function loadWhiteLabelContext(): Promise<WhiteLabelBrand> {
  return (await request<{ data: WhiteLabelBrand }>('/api/white-label-context')).data
}

export async function loadWhiteLabelDomains(): Promise<WhiteLabelDomain[]> {
  return (await request<{ data: WhiteLabelDomain[] }>('/api/white-label-domains')).data
}

export async function requestWhiteLabelDomain(hostname: string): Promise<WhiteLabelDomain> {
  return (await request<{ data: WhiteLabelDomain }>('/api/white-label-domains', { method: 'POST', body: JSON.stringify({ hostname }) })).data
}

export async function updateWhiteLabelDomain(input: {
  domainId: string
  action: 'verify' | 'set_primary' | 'disable'
  verificationReference?: string
  makePrimary?: boolean
}): Promise<WhiteLabelDomain> {
  return (await request<{ data: WhiteLabelDomain }>('/api/white-label-domains', { method: 'PUT', body: JSON.stringify(input) })).data
}

export async function loadWhiteLabelCatalog(): Promise<WhiteLabelCatalogCourse[]> {
  return (await request<{ data: WhiteLabelCatalogCourse[] }>('/api/white-label-catalog')).data
}

export async function saveWhiteLabelCatalog(courseIds: string[], featuredCourseIds: string[]) {
  return request<{ data: { courseIds: string[]; featuredCourseIds: string[]; updatedAt: string } }>('/api/white-label-catalog', {
    method: 'PUT', body: JSON.stringify({ courseIds, featuredCourseIds }),
  })
}
