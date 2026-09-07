import { authenticatedJson } from './authenticatedFetch'

export interface AcademyCoreContext {
  userId: string
  tenantId: string
  identitySource: 'core_api' | 'legacy_proxy'
  coreRole: string | null
  roles: string[]
  permissions: string[]
  mfaSatisfied: boolean | null
}

export async function loadAcademyCoreContext(): Promise<AcademyCoreContext> {
  const response = await authenticatedJson<{ data: AcademyCoreContext }>('/api/core-context')
  return response.data
}
