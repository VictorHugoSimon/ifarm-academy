import { json, type Env } from './_shared'

export interface AdminContext {
  userId: string
  tenantId?: string
  roles: string[]
}

const normalizeRoles = (value: string | null): string[] =>
  Array.from(new Set(
    (value ?? '')
      .split(',')
      .map((role) => role.trim().toLowerCase())
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

export function requireAdminContext(
  env: Env,
  request: Request,
  allowedRoles: string[],
): AdminContext | Response {
  const configuredSecret = env.ACADEMY_ADMIN_PROXY_SECRET
  if (!configuredSecret) {
    return json({ error: 'Admin identity boundary not configured' }, 503)
  }

  const providedSecret = request.headers.get('x-ifarm-proxy-secret') ?? ''
  if (!providedSecret || !secureEqual(providedSecret, configuredSecret)) {
    return json({ error: 'Admin proxy authentication failed' }, 401)
  }

  const userId = request.headers.get('x-ifarm-user-id')?.trim() ?? ''
  if (!userId) return json({ error: 'Authenticated iFarm user is required' }, 401)

  const roles = normalizeRoles(request.headers.get('x-ifarm-roles'))
  const normalizedAllowed = allowedRoles.map((role) => role.toLowerCase())
  if (!roles.some((role) => normalizedAllowed.includes(role))) {
    return json({ error: 'Insufficient Academy role' }, 403)
  }

  const tenantId = request.headers.get('x-ifarm-tenant-id')?.trim() || undefined
  return { userId, tenantId, roles }
}
