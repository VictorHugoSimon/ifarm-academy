import { json, type Env } from './_shared'

export type CoreFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface CoreIdentityContext {
  userId: string
  tenantId: string
  membershipId?: string
  roleId?: string
  coreRole?: string
  roles: string[]
  permissions: string[]
  isIfarmAdmin: boolean
  mfaRequired: boolean
  mfaVerified: boolean
  mfaSatisfied: boolean
  identitySource: 'core_api'
  coreRequestId?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const BEARER_RE = /^Bearer\s+([^\s]+)$/i
const PRIVILEGED_CORE_ROLES = new Set(['owner', 'tenant_admin'])
const CORE_ROLE_MAP: Record<string, string> = {
  manager: 'academy_manager',
  technical: 'academy_technical',
  operator: 'academy_operator',
  finance: 'academy_finance',
  partner: 'academy_partner',
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function readOptionalUuid(value: unknown): string | undefined {
  return isUuid(value) ? value : undefined
}

function readOptionalString(value: unknown, max = 160): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text && text.length <= max ? text : undefined
}

function readBoolean(value: unknown): boolean {
  return value === true
}

export function normalizeCoreApiUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
    if (url.username || url.password || url.search || url.hash) return null
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function coreRequestTimeoutMs(env: Env): number {
  const value = Number(env.ACADEMY_CORE_REQUEST_TIMEOUT_MS ?? 4000)
  if (!Number.isFinite(value)) return 4000
  return Math.min(10_000, Math.max(500, Math.trunc(value)))
}

export function extractBearerAuthorization(request: Request): string | null {
  const header = request.headers.get('authorization')?.trim() ?? ''
  return BEARER_RE.test(header) ? header : null
}

export function mapCoreRoleToAcademyRoles(input: {
  coreRole?: string
  isIfarmAdmin: boolean
  mfaSatisfied: boolean
}): string[] {
  const coreRole = input.coreRole?.trim().toLowerCase()
  const roles = new Set<string>()
  if (coreRole) roles.add(`core_${coreRole}`)

  if (input.isIfarmAdmin && input.mfaSatisfied) {
    roles.add('ifarm_admin')
    roles.add('academy_admin')
  }

  if (coreRole && PRIVILEGED_CORE_ROLES.has(coreRole) && input.mfaSatisfied) {
    roles.add('academy_admin')
  }

  if (coreRole && CORE_ROLE_MAP[coreRole]) roles.add(CORE_ROLE_MAP[coreRole])
  return [...roles]
}

function upstreamFailure(status: number): Response {
  if (status === 401) return json({ error: 'CORE_AUTH_REQUIRED', message: 'Sessão iFarm inválida ou expirada.' }, 401)
  if (status === 403) return json({ error: 'CORE_FORBIDDEN', message: 'A identidade iFarm não possui acesso a este contexto.' }, 403)
  return json({ error: 'CORE_IDENTITY_UNAVAILABLE', message: 'O iFarm Core não confirmou a identidade neste momento.' }, 503)
}

async function coreGet(fetcher: CoreFetch, url: string, authorization: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetcher(url, {
      method: 'GET',
      headers: { authorization, accept: 'application/json' },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function resolveCoreIdentity(
  env: Env,
  request: Request,
  fetcher: CoreFetch = fetch,
): Promise<CoreIdentityContext | Response> {
  const baseUrl = env.ACADEMY_CORE_API_URL ? normalizeCoreApiUrl(env.ACADEMY_CORE_API_URL) : null
  if (!baseUrl) return json({ error: 'CORE_IDENTITY_NOT_CONFIGURED', message: 'ACADEMY_CORE_API_URL não está configurada corretamente.' }, 503)

  const authorization = extractBearerAuthorization(request)
  if (!authorization) return json({ error: 'CORE_AUTH_REQUIRED', message: 'Authorization Bearer do iFarm Core é obrigatório.' }, 401)

  const timeoutMs = coreRequestTimeoutMs(env)
  let meResponse: Response
  try {
    meResponse = await coreGet(fetcher, `${baseUrl}/api/v1/me`, authorization, timeoutMs)
  } catch {
    return json({ error: 'CORE_IDENTITY_UNAVAILABLE', message: 'Não foi possível consultar o iFarm Core.' }, 503)
  }
  if (!meResponse.ok) return upstreamFailure(meResponse.status)

  let me: Record<string, unknown>
  try { me = await meResponse.json() as Record<string, unknown> }
  catch { return json({ error: 'CORE_IDENTITY_INVALID', message: 'Resposta de identidade do iFarm Core é inválida.' }, 503) }

  const userId = isUuid(me.id) ? me.id : null
  const tenantId = isUuid(me.tenantId) ? me.tenantId : null
  if (!userId) return json({ error: 'CORE_IDENTITY_INVALID', message: 'iFarm Core não retornou um usuário válido.' }, 503)
  if (!tenantId) return json({ error: 'TENANT_CONTEXT_REQUIRED', message: 'Selecione uma empresa/tenant ativo no iFarm Core antes de acessar a Academy.' }, 409)

  const mfa = me.mfa && typeof me.mfa === 'object' ? me.mfa as Record<string, unknown> : {}
  const mfaRequired = readBoolean(mfa.required)
  const mfaVerified = readBoolean(mfa.verified)
  const mfaSatisfied = readBoolean(mfa.satisfied) || (!mfaRequired && mfaVerified) || (!mfaRequired && mfa.satisfied !== false)
  const isIfarmAdmin = readBoolean(me.ifarmAdmin)
  const coreRole = readOptionalString(me.role, 80)?.toLowerCase()

  let permissionResponse: Response
  try {
    permissionResponse = await coreGet(fetcher, `${baseUrl}/api/v1/me/permissions`, authorization, timeoutMs)
  } catch {
    return json({ error: 'CORE_PERMISSIONS_UNAVAILABLE', message: 'Não foi possível carregar as permissões do iFarm Core.' }, 503)
  }
  if (!permissionResponse.ok) return upstreamFailure(permissionResponse.status)

  let permissionPayload: Record<string, unknown>
  try { permissionPayload = await permissionResponse.json() as Record<string, unknown> }
  catch { return json({ error: 'CORE_PERMISSIONS_INVALID', message: 'Resposta de permissões do iFarm Core é inválida.' }, 503) }

  const permissions = Array.isArray(permissionPayload.permissions)
    ? [...new Set(permissionPayload.permissions.filter((value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 120))]
    : []
  const roles = mapCoreRoleToAcademyRoles({ coreRole, isIfarmAdmin, mfaSatisfied })

  return {
    userId,
    tenantId,
    membershipId: readOptionalUuid(me.membershipId),
    roleId: readOptionalUuid(me.roleId),
    coreRole,
    roles,
    permissions,
    isIfarmAdmin,
    mfaRequired,
    mfaVerified,
    mfaSatisfied,
    identitySource: 'core_api',
    coreRequestId: readOptionalString(me.requestId, 120),
  }
}
