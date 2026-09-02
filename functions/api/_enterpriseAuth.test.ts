import { describe, expect, it } from 'vitest'
import { requireCompanyScope, requireEnterpriseContext, requireGlobalEnterpriseAdmin } from './_enterpriseAuth'

const env = { ACADEMY_ADMIN_PROXY_SECRET: 'secret' }

function request(roles: string, companyId?: string) {
  const headers: Record<string, string> = {
    'x-ifarm-proxy-secret': 'secret',
    'x-ifarm-user-id': 'USER-1',
    'x-ifarm-tenant-id': 'TENANT-1',
    'x-ifarm-roles': roles,
  }
  if (companyId) headers['x-ifarm-company-id'] = companyId
  return new Request('https://academy.test/api/companies', { headers })
}

describe('enterprise authorization', () => {
  it('allows Academy admin to manage every company in its tenant', () => {
    const result = requireEnterpriseContext(env, request('academy_admin'))
    expect(result).not.toBeInstanceOf(Response)
    if (result instanceof Response) return
    expect(result.canManageAllCompanies).toBe(true)
    expect(requireCompanyScope(result, 'COMPANY-X')).toBeNull()
  })

  it('requires trusted company scope for company admin', () => {
    const result = requireEnterpriseContext(env, request('company_admin'))
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(403)
  })

  it('allows company admin only inside delegated company', () => {
    const result = requireEnterpriseContext(env, request('company_admin', 'COMPANY-A'))
    expect(result).not.toBeInstanceOf(Response)
    if (result instanceof Response) return
    expect(result.canManageAllCompanies).toBe(false)
    expect(requireCompanyScope(result, 'COMPANY-A')).toBeNull()
    expect(requireCompanyScope(result, 'COMPANY-B')).toBeInstanceOf(Response)
  })

  it('prevents company admin from creating a company', () => {
    const result = requireEnterpriseContext(env, request('company_admin', 'COMPANY-A'))
    expect(result).not.toBeInstanceOf(Response)
    if (result instanceof Response) return
    expect(requireGlobalEnterpriseAdmin(result)).toBeInstanceOf(Response)
  })
})
