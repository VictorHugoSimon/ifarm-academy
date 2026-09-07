import { json, type Env } from './_shared'

export interface TrustedContext {
  userId: string
  tenantId: string
  roles: string[]
  permissions: string[]
  coreRole?: string
  mfaSatisfied?: boolean
  identitySource: 'core_api' | 'legacy_proxy'
  displayName?: string
}

export type AdminContext = TrustedContext

const normalizeCsv = (value: string | null): string[] =>
  Array.from(new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  ))

function secureEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

function contextFromTrustedHeaders(request: Request): TrustedContext | Response {
  const userId = request.headers.get('x-ifarm-user-id')?.trim() ?? ''
  if (!userId) return json({ error: 'Authenticated iFarm user is required' }, 401)

  const tenantId = request.headers.get('x-ifarm-tenant-id')?.trim() ?? ''
  if (!tenantId) return json({ error: 'Authenticated iFarm tenant is required' }, 401)

  const roles = normalizeCsv(request.headers.get('x-ifarm-roles'))
  const permissions = normalizeCsv(request.headers.get('x-ifarm-core-permissions'))
  const displayName = request.headers.get('x-ifarm-user-name')?.trim() || undefined
  const coreRole = request.headers.get('x-ifarm-core-role')?.trim().toLowerCase() || undefined
  const identitySource = request.headers.get('x-ifarm-identity-source') === 'core_api' ? 'core_api' : 'legacy_proxy'
  const mfaHeader = request.headers.get('x-ifarm-mfa-satisfied')
  const mfaSatisfied = mfaHeader == null ? undefined : mfaHeader === 'true'

  return {
    userId,
    tenantId,
    roles,
    permissions,
    coreRole,
    mfaSatisfied,
    identitySource,
    ...(displayName ? { displayName } : {}),
  }
}

function validateProxySecret(env: Env, request: Request, admin = false): Response | null {
  const configuredSecret = env.ACADEMY_ADMIN_PROXY_SECRET
  if (!configuredSecret) {
    return json({ error: admin ? 'Admin identity boundary not configured' : 'iFarm identity boundary not configured' }, 503)
  }

  const providedSecret = request.headers.get('x-ifarm-proxy-secret') ?? ''
  if (!providedSecret || !secureEqual(providedSecret, configuredSecret)) {
    return json({ error: admin ? 'Admin proxy authentication failed' : 'iFarm proxy authentication failed' }, 401)
  }
  return null
}

export function requireTrustedContext(
  env: Env,
  request: Request,
): TrustedContext | Response {
  const proxyFailure = validateProxySecret(env, request)
  if (proxyFailure) return proxyFailure
  return contextFromTrustedHeaders(request)
}

export function requireAdminContext(
  env: Env,
  request: Request,
  allowedRoles: string[],
): AdminContext | Response {
  const proxyFailure = validateProxySecret(env, request, true)
  if (proxyFailure) return proxyFailure

  const context = contextFromTrustedHeaders(request)
  if (context instanceof Response) return context

  const normalizedAllowed = allowedRoles.map((role) => role.toLowerCase())
  if (!context.roles.some((role) => normalizedAllowed.includes(role))) {
    return json({ error: 'Insufficient Academy role' }, 403)
  }

  return context
}
