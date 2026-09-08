import { authenticatedJson } from './authenticatedFetch'
import type { CompanyMemberRecord } from './enterpriseApi'

export interface CoreMembershipDirectoryItem {
  membershipId: string
  userId: string
  displayName: string
  email: string | null
  organizationId: string | null
  roleCode: string
  status: 'active'
}

export async function loadCoreMembershipDirectory(): Promise<CoreMembershipDirectoryItem[]> {
  const result = await authenticatedJson<{ data: CoreMembershipDirectoryItem[] }>('/api/core-memberships')
  return result.data
}

export async function addVerifiedCompanyMember(companyId: string, input: {
  membershipId: string
  employeeCode?: string
  jobTitle?: string
}) {
  return authenticatedJson<{ data: CompanyMemberRecord & { coreMembershipId?: string | null }; reactivated?: boolean }>(
    `/api/companies/${encodeURIComponent(companyId)}/members`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}
