import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet, onRequestPost } from './core-session'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const TENANT_ID = '22222222-2222-4222-8222-222222222222'

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('Core session bootstrap', () => {
  it('carrega identidade, memberships e permissões antes de exigir tenant ativo', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/v1/me')) {
        return response({
          id: USER_ID,
          tenantId: null,
          role: null,
          ifarmAdmin: false,
          mfa: { required: false, verified: false, satisfied: true },
        })
      }
      if (url.endsWith('/api/v1/tenants')) {
        return response({ tenants: [{
          tenant_id: TENANT_ID,
          slug: 'fazenda-modelo',
          legal_name: 'Fazenda Modelo Ltda',
          trade_name: 'Fazenda Modelo',
          role_code: 'manager',
          active: true,
        }] })
      }
      if (url.endsWith('/api/v1/me/permissions')) {
        return response({ permissions: ['organization.manage', 'user.manage', 'notification.manage'] })
      }
      return response({}, 404)
    }))

    const result = await onRequestGet({
      env: { ACADEMY_CORE_API_URL: 'https://core.ifarm.test' },
      request: new Request('https://academy.test/api/core-session', {
        headers: { authorization: 'Bearer valid-token' },
      }),
    })

    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({
      data: {
        userId: USER_ID,
        tenantId: null,
        permissions: ['organization.manage', 'user.manage', 'notification.manage'],
        tenants: [{ id: TENANT_ID, tradeName: 'Fazenda Modelo', active: true }],
      },
    })
  })

  it('falha fechado quando permissões Core não podem ser carregadas', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/v1/me')) return response({ id: USER_ID, tenantId: TENANT_ID })
      if (url.endsWith('/api/v1/tenants')) return response({ tenants: [] })
      if (url.endsWith('/api/v1/me/permissions')) return response({ error: 'forbidden' }, 403)
      return response({}, 404)
    }))

    const result = await onRequestGet({
      env: { ACADEMY_CORE_API_URL: 'https://core.ifarm.test' },
      request: new Request('https://academy.test/api/core-session', {
        headers: { authorization: 'Bearer valid-token' },
      }),
    })
    expect(result.status).toBe(403)
  })

  it('troca tenant exclusivamente pelo endpoint oficial do Core', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({ tenantId: TENANT_ID })
      return response({ tenantId: TENANT_ID })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await onRequestPost({
      env: { ACADEMY_CORE_API_URL: 'https://core.ifarm.test' },
      request: new Request('https://academy.test/api/core-session', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      }),
    })

    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ data: { tenantId: TENANT_ID } })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/me/active-tenant')
  })
})
