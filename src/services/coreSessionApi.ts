import { authenticatedJson } from './authenticatedFetch'

export interface CoreTenantMembership {
  id: string
  slug: string
  legalName: string
  tradeName: string | null
  role: string | null
  active: boolean
}

export interface CoreSessionSnapshot {
  userId: string
  tenantId: string | null
  role: string | null
  ifarmAdmin: boolean
  mfa: {
    required: boolean
    verified: boolean
    satisfied: boolean
  }
  tenants: CoreTenantMembership[]
}

export async function loadCoreSession(): Promise<CoreSessionSnapshot> {
  const payload = await authenticatedJson<{ data: CoreSessionSnapshot }>('/api/core-session')
  return payload.data
}

export async function activateCoreTenant(tenantId: string): Promise<string> {
  const payload = await authenticatedJson<{ data: { tenantId: string } }>('/api/core-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenantId }),
  })
  return payload.data.tenantId
}
