import { requireAdminContext, type AdminContext } from './_auth'
import { json, type Env } from './_shared'

const globalRoles = ['academy_admin', 'ifarm_admin']
const enterpriseManagerRoles = ['academy_enterprise_manager']
const legacyCompanyRoles = ['company_admin', 'academy_company_admin']

export interface EnterpriseContext extends AdminContext {
  canManageAllCompanies: boolean
  canCreateCompanies: boolean
  companyScopeId?: string
}

export function requireEnterpriseContext(env: Env, request: Request): EnterpriseContext | Response {
  const auth = requireAdminContext(env, request, [
    ...globalRoles,
    ...enterpriseManagerRoles,
    ...legacyCompanyRoles,
  ])
  if (auth instanceof Response) return auth

  const globalAdmin = auth.roles.some((role) => globalRoles.includes(role))
  if (globalAdmin) {
    return { ...auth, canManageAllCompanies: true, canCreateCompanies: true }
  }

  // Capacidade derivada de permissões verificadas no iFarm Core. O manager opera
  // a vertical empresarial inteira do tenant ativo, sem receber administração
  // global da Academy e sem poder criar novas empresas Academy.
  const enterpriseManager = auth.roles.some((role) => enterpriseManagerRoles.includes(role))
  if (enterpriseManager) {
    return { ...auth, canManageAllCompanies: true, canCreateCompanies: false }
  }

  // Compatibilidade temporária do boundary legado de DEV. Esse caminho continua
  // exigindo um scope de empresa explicitamente confiável; o Core atual não o emite.
  const companyScopeId = request.headers.get('x-ifarm-company-id')?.trim() ?? ''
  if (!companyScopeId) return json({ error: 'Trusted iFarm company scope is required for company administrator' }, 403)

  return { ...auth, canManageAllCompanies: false, canCreateCompanies: false, companyScopeId }
}

export function requireCompanyScope(auth: EnterpriseContext, companyId: string): Response | null {
  if (auth.canManageAllCompanies) return null
  if (auth.companyScopeId === companyId) return null
  return json({ error: 'Company administrator cannot access another company' }, 403)
}

export function requireGlobalEnterpriseAdmin(auth: EnterpriseContext): Response | null {
  return auth.canCreateCompanies ? null : json({ error: 'Only Academy/iFarm administrators can create companies' }, 403)
}
