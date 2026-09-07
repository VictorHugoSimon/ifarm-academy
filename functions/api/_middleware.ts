import { extractBearerAuthorization, resolveCoreIdentity } from './_coreIdentity'
import { json, type Env } from './_shared'

const INTERNAL_HEADERS = [
  'x-ifarm-proxy-secret',
  'x-ifarm-user-id',
  'x-ifarm-tenant-id',
  'x-ifarm-roles',
  'x-ifarm-user-name',
  'x-ifarm-core-permissions',
  'x-ifarm-core-role',
  'x-ifarm-mfa-satisfied',
  'x-ifarm-identity-source',
] as const

function sanitizedRequest(request: Request): Request {
  const headers = new Headers(request.headers)
  for (const header of INTERNAL_HEADERS) headers.delete(header)
  return new Request(request, { headers })
}

export const onRequest = async ({ env, request, next }: {
  env: Env
  request: Request
  next: (request?: Request) => Promise<Response>
}) => {
  // Sem Core configurado, preserva temporariamente o boundary v0.15 para DEV/testes.
  if (!env.ACADEMY_CORE_API_URL) return next(request)

  const cleanRequest = sanitizedRequest(request)
  const authorization = extractBearerAuthorization(cleanRequest)

  // Requests públicos sem Bearer seguem sem identidade. Endpoints protegidos continuarão
  // fail-closed em requireTrustedContext/requireAdminContext porque os headers internos
  // enviados pelo cliente foram removidos acima.
  if (!authorization) return next(cleanRequest)

  if (!env.ACADEMY_ADMIN_PROXY_SECRET) {
    return json({
      error: 'CORE_BRIDGE_NOT_CONFIGURED',
      message: 'O bridge interno Academy/Core não está configurado neste ambiente.',
    }, 503)
  }

  const identity = await resolveCoreIdentity(env, cleanRequest)
  if (identity instanceof Response) return identity

  const headers = new Headers(cleanRequest.headers)
  headers.set('x-ifarm-proxy-secret', env.ACADEMY_ADMIN_PROXY_SECRET)
  headers.set('x-ifarm-user-id', identity.userId)
  headers.set('x-ifarm-tenant-id', identity.tenantId)
  headers.set('x-ifarm-roles', identity.roles.join(','))
  headers.set('x-ifarm-core-permissions', identity.permissions.join(','))
  headers.set('x-ifarm-identity-source', identity.identitySource)
  headers.set('x-ifarm-mfa-satisfied', identity.mfaSatisfied ? 'true' : 'false')
  if (identity.coreRole) headers.set('x-ifarm-core-role', identity.coreRole)

  return next(new Request(cleanRequest, { headers }))
}
