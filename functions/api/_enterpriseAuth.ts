import { requireAdminContext, type AdminContext } from './_auth'
import { json, type Env } from './_shared'

const globalRoles = ['academy_admin', 'ifarm_admin']
const companyRoles = ['company_admin', 'academy_company_admin']

export interface EnterpriseContext extends AdminContext {
  canManageAllCompanies: boolean
  companyScopeId?: string
}

export function requireEnterpriseContext(env: Env, request: Request): EnterpriseContext | Response {
  const auth = requireAdminContext(env, request, [...globalRoles, ...companyRoles])
  if (auth instanceof Response) return auth

  const canManageAllCompanies = auth.roles.some((role) => globalRoles.includes(role))
  if (canManageAllCompanies) return { ...auth, canManageAllCompanies: true }

  const companyScopeId = request.headers.get('x-ifarm-company-id')?.trim() ?? ''
  if (!companyScopeId) return json({ error: 'Trusted iFarm company scope is required for company administrator' }, 403)

  return { ...auth, canManageAllCompanies: false, companyScopeId }
}

export function requireCompanyScope(auth: EnterpriseContext, companyId: string): Response | null {
  if (auth.canManageAllCompanies) return null
  if (auth.companyScopeId === companyId) return null
  return json({ error: 'Company administrator cannot access another company' }, 403)
}

export function requireGlobalEnterpriseAdmin(auth: EnterpriseContext): Response | null {
  return auth.canManageAllCompanies ? null : json({ error: 'Only Academy/iFarm administrators can create companies' }, 403)
}
