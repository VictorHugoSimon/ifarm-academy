export type MarketplaceStatus = 'submitted' | 'under_review' | 'changes_requested' | 'approved' | 'rejected' | 'published' | 'withdrawn'

export interface MarketplaceCourseOption {
  id: string
  title: string
  status: string
  instructors?: string | null
}

export interface MarketplacePermissions {
  canSubmit: boolean
  canReview: boolean
  canConfigureCommission: boolean
  canPublish: boolean
}

export interface CommissionRuleSummary {
  id: string
  version: number
  calculationMode: 'percentage' | 'fixed_amount'
  ifarmShareValue: number
  instructorShareValue: number
  partnerShareValue: number
  gatewayFeeResponsibility: 'ifarm' | 'instructor' | 'partner' | 'shared'
  validFrom: string
  validUntil?: string | null
}

export interface MarketplaceSubmission {
  id: string
  courseId: string
  courseTitle: string
  courseStatus: string
  submitterInstructorId: string
  instructorName: string
  status: MarketplaceStatus
  submissionNote?: string | null
  reviewNote?: string | null
  submittedAt: string
  reviewedAt?: string | null
  publishedAt?: string | null
  activeCommissionRule?: CommissionRuleSummary | null
}

export interface MarketplaceCatalogItem {
  submissionId: string
  courseId: string
  title: string
  description: string
  instructor: { id: string; name: string }
  publishedAt: string
  commercialStatus: 'listed'
  checkoutReady: boolean
  commissionRuleVersion: number
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  return response.json() as Promise<T>
}

export async function loadMarketplacePermissions(): Promise<MarketplacePermissions> {
  return (await request<{ data: MarketplacePermissions }>('/api/marketplace-permissions')).data
}

export async function loadMarketplaceEligibleCourses(): Promise<MarketplaceCourseOption[]> {
  return (await request<{ data: MarketplaceCourseOption[] }>('/api/marketplace-eligible-courses')).data
}

export async function loadMarketplaceSubmissions(): Promise<MarketplaceSubmission[]> {
  return (await request<{ data: MarketplaceSubmission[] }>('/api/marketplace-submissions')).data
}

export async function submitCourseToMarketplace(courseId: string, submissionNote?: string) {
  return request<{ data: { id: string; status: MarketplaceStatus } }>('/api/marketplace-submissions', {
    method: 'POST', body: JSON.stringify({ courseId, submissionNote }),
  })
}

export async function reviewMarketplaceSubmission(submissionId: string, targetStatus: MarketplaceStatus, reviewNote?: string) {
  return request<{ data: { id: string; status: MarketplaceStatus } }>('/api/marketplace-review', {
    method: 'POST', body: JSON.stringify({ submissionId, targetStatus, reviewNote }),
  })
}

export async function activateMarketplaceCommissionRule(input: {
  submissionId: string
  calculationMode: 'percentage' | 'fixed_amount'
  ifarmShareValue: number
  instructorShareValue: number
  partnerShareValue: number
  currency?: string
  gatewayFeeResponsibility: 'ifarm' | 'instructor' | 'partner' | 'shared'
  validFrom: string
  validUntil?: string | null
  rationale: string
  confirmed: boolean
}) {
  return request<{ data: CommissionRuleSummary }>('/api/marketplace-commission-rules', {
    method: 'POST', body: JSON.stringify(input),
  })
}

export async function publishMarketplaceSubmission(submissionId: string) {
  return request<{ data: { id: string; status: 'published'; publishedAt: string; commissionRuleVersion: number } }>('/api/marketplace-publication', {
    method: 'POST', body: JSON.stringify({ submissionId }),
  })
}

export async function loadMarketplaceCatalog(): Promise<MarketplaceCatalogItem[]> {
  return (await request<{ data: MarketplaceCatalogItem[] }>('/api/marketplace-catalog')).data
}
