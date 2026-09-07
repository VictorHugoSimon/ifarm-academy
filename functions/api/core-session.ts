import { coreRequestTimeoutMs, extractBearerAuthorization, normalizeCoreApiUrl } from './_coreIdentity'
import { json, type Env } from './_shared'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function callCore(
  env: Env,
  authorization: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const baseUrl = env.ACADEMY_CORE_API_URL ? normalizeCoreApiUrl(env.ACADEMY_CORE_API_URL) : null
  if (!baseUrl) throw new Error('CORE_NOT_CONFIGURED')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), coreRequestTimeoutMs(env))
  try {
    const headers = new Headers(init.headers)
    headers.set('authorization', authorization)
    headers.set('accept', 'application/json')
    return await fetch(`${baseUrl}${path}`, { ...init, headers, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function upstreamError(status: number): Response {
  if (status === 400) return json({ error: 'CORE_INVALID_REQUEST', message: 'O iFarm Core rejeitou os dados informados.' }, 400)
  if (status === 401) return json({ error: 'CORE_AUTH_REQUIRED', message: 'Sessão iFarm inválida ou expirada.' }, 401)
  if (status === 403) return json({ error: 'CORE_FORBIDDEN', message: 'A identidade iFarm não possui acesso a este contexto.' }, 403)
  if (status === 404) return json({ error: 'CORE_TENANT_NOT_FOUND', message: 'Empresa/tenant não encontrado para esta identidade.' }, 404)
  if (status === 409) return json({ error: 'CORE_TENANT_CONFLICT', message: 'Não foi possível ativar este tenant no contexto atual.' }, 409)
  return json({ error: 'CORE_SESSION_UNAVAILABLE', message: 'O iFarm Core não confirmou a sessão neste momento.' }, 503)
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeMfa(value: unknown) {
  const mfa = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    required: mfa.required === true,
    verified: mfa.verified === true,
    satisfied: mfa.satisfied === true,
  }
}

function normalizeTenantRows(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const id = safeString(row.tenant_id)
    if (!id || !UUID_RE.test(id)) return []
    return [{
      id,
      slug: safeString(row.slug) ?? id,
      legalName: safeString(row.legal_name) ?? id,
      tradeName: safeString(row.trade_name),
      role: safeString(row.role_code),
      active: row.active === true,
    }]
  })
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const authorization = extractBearerAuthorization(request)
  if (!authorization) return json({ error: 'CORE_AUTH_REQUIRED', message: 'Authorization Bearer do iFarm Core é obrigatório.' }, 401)

  let meResponse: Response
  let tenantsResponse: Response
  try {
    ;[meResponse, tenantsResponse] = await Promise.all([
      callCore(env, authorization, '/api/v1/me'),
      callCore(env, authorization, '/api/v1/tenants'),
    ])
  } catch {
    return json({ error: 'CORE_SESSION_UNAVAILABLE', message: 'Não foi possível consultar a sessão do iFarm Core.' }, 503)
  }

  if (!meResponse.ok) return upstreamError(meResponse.status)
  if (!tenantsResponse.ok) return upstreamError(tenantsResponse.status)

  let me: Record<string, unknown>
  let tenantPayload: Record<string, unknown>
  try {
    me = await meResponse.json() as Record<string, unknown>
    tenantPayload = await tenantsResponse.json() as Record<string, unknown>
  } catch {
    return json({ error: 'CORE_SESSION_INVALID', message: 'O iFarm Core retornou uma sessão inválida.' }, 503)
  }

  const userId = safeString(me.id)
  if (!userId || !UUID_RE.test(userId)) {
    return json({ error: 'CORE_SESSION_INVALID', message: 'O iFarm Core não retornou um usuário válido.' }, 503)
  }

  const tenantId = safeString(me.tenantId)
  return json({
    data: {
      userId,
      tenantId: tenantId && UUID_RE.test(tenantId) ? tenantId : null,
      role: safeString(me.role),
      ifarmAdmin: me.ifarmAdmin === true,
      mfa: normalizeMfa(me.mfa),
      tenants: normalizeTenantRows(tenantPayload.tenants),
    },
  })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const authorization = extractBearerAuthorization(request)
  if (!authorization) return json({ error: 'CORE_AUTH_REQUIRED', message: 'Authorization Bearer do iFarm Core é obrigatório.' }, 401)

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> }
  catch { return json({ error: 'INVALID_JSON', message: 'JSON inválido.' }, 400) }

  const tenantId = safeString(body.tenantId)
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return json({ error: 'INVALID_TENANT_ID', message: 'tenantId deve ser um UUID válido.' }, 400)
  }

  let response: Response
  try {
    response = await callCore(env, authorization, '/api/v1/me/active-tenant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    })
  } catch {
    return json({ error: 'CORE_SESSION_UNAVAILABLE', message: 'Não foi possível alterar o tenant no iFarm Core.' }, 503)
  }

  if (!response.ok) return upstreamError(response.status)

  let payload: Record<string, unknown>
  try { payload = await response.json() as Record<string, unknown> }
  catch { return json({ error: 'CORE_SESSION_INVALID', message: 'O iFarm Core retornou uma resposta inválida.' }, 503) }

  const activatedTenantId = safeString(payload.tenantId)
  if (!activatedTenantId || !UUID_RE.test(activatedTenantId)) {
    return json({ error: 'CORE_SESSION_INVALID', message: 'O iFarm Core não confirmou o tenant ativo.' }, 503)
  }

  return json({ data: { tenantId: activatedTenantId } })
}
