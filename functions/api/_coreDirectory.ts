import { coreRequestTimeoutMs, extractBearerAuthorization, normalizeCoreApiUrl, type CoreFetch } from './_coreIdentity'
import { json, type Env } from './_shared'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface CoreMembershipDirectoryItem {
  membershipId: string
  tenantId: string
  organizationId: string | null
  userId: string
  displayName: string
  email: string | null
  roleCode: string
  status: 'active'
}

function text(value: unknown, max = 254): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized && normalized.length <= max ? normalized : null
}

function uuid(value: unknown): string | null {
  const normalized = text(value, 80)
  return normalized && UUID_RE.test(normalized) ? normalized : null
}

function coreFailure(status: number): Response {
  if (status === 401) return json({ error: 'CORE_AUTH_REQUIRED', message: 'Sessão iFarm inválida ou expirada.' }, 401)
  if (status === 403) return json({ error: 'CORE_USER_DIRECTORY_FORBIDDEN', message: 'A identidade não pode consultar o diretório de usuários do iFarm Core.' }, 403)
  return json({ error: 'CORE_USER_DIRECTORY_UNAVAILABLE', message: 'O diretório de usuários do iFarm Core está indisponível.' }, 503)
}

export async function loadCoreMembershipDirectory(
  env: Env,
  request: Request,
  expectedTenantId: string,
  fetcher: CoreFetch = fetch,
): Promise<CoreMembershipDirectoryItem[] | Response> {
  const baseUrl = env.ACADEMY_CORE_API_URL ? normalizeCoreApiUrl(env.ACADEMY_CORE_API_URL) : null
  if (!baseUrl) return json({ error: 'CORE_DIRECTORY_NOT_CONFIGURED', message: 'iFarm Core não está configurado neste ambiente.' }, 503)
  const authorization = extractBearerAuthorization(request)
  if (!authorization) return json({ error: 'CORE_AUTH_REQUIRED', message: 'Authorization Bearer do iFarm Core é obrigatório.' }, 401)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), coreRequestTimeoutMs(env))
  let response: Response
  try {
    response = await fetcher(`${baseUrl}/api/v1/memberships`, {
      method: 'GET',
      headers: { authorization, accept: 'application/json' },
      signal: controller.signal,
    })
  } catch {
    return json({ error: 'CORE_USER_DIRECTORY_UNAVAILABLE', message: 'Não foi possível consultar memberships no iFarm Core.' }, 503)
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) return coreFailure(response.status)

  let payload: Record<string, unknown>
  try { payload = await response.json() as Record<string, unknown> }
  catch { return json({ error: 'CORE_USER_DIRECTORY_INVALID', message: 'O iFarm Core retornou um diretório inválido.' }, 503) }

  const rows = Array.isArray(payload.memberships) ? payload.memberships : []
  return rows.flatMap((raw): CoreMembershipDirectoryItem[] => {
    if (!raw || typeof raw !== 'object') return []
    const row = raw as Record<string, unknown>
    const membershipId = uuid(row.id)
    const tenantId = uuid(row.tenant_id)
    const userId = uuid(row.user_id)
    const roleCode = text(row.role_code, 80)
    if (!membershipId || !tenantId || !userId || !roleCode) return []
    if (tenantId !== expectedTenantId || row.status !== 'active') return []
    const email = text(row.user_email, 254)
    const displayName = text(row.user_name, 160) ?? email ?? userId
    return [{
      membershipId,
      tenantId,
      organizationId: uuid(row.organization_id),
      userId,
      displayName,
      email,
      roleCode,
      status: 'active',
    }]
  })
}

export async function resolveCoreMembership(
  env: Env,
  request: Request,
  expectedTenantId: string,
  membershipId: string,
  fetcher: CoreFetch = fetch,
): Promise<CoreMembershipDirectoryItem | Response> {
  if (!UUID_RE.test(membershipId)) return json({ error: 'INVALID_MEMBERSHIP_ID', message: 'membershipId inválido.' }, 400)
  const directory = await loadCoreMembershipDirectory(env, request, expectedTenantId, fetcher)
  if (directory instanceof Response) return directory
  const membership = directory.find((item) => item.membershipId === membershipId)
  return membership ?? json({ error: 'CORE_MEMBERSHIP_NOT_FOUND', message: 'Membership ativa não encontrada no tenant atual do iFarm Core.' }, 404)
}
