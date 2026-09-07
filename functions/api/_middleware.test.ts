import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from './_middleware'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const TENANT_ID = '22222222-2222-4222-8222-222222222222'

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('Academy Core identity middleware', () => {
  it('remove headers internos forjados mesmo em request público sem Bearer', async () => {
    const request = new Request('https://academy.test/api/public-catalog', {
      headers: {
        'x-ifarm-user-id': 'forged-user',
        'x-ifarm-tenant-id': 'forged-tenant',
        'x-ifarm-roles': 'ifarm_admin,academy_admin',
        'x-ifarm-proxy-secret': 'forged-secret',
      },
    })

    const result = await onRequest({
      env: { ACADEMY_CORE_API_URL: 'https://core.ifarm.test', ACADEMY_ADMIN_PROXY_SECRET: 'internal-only' },
      request,
      next: async (cleaned) => response({
        userId: cleaned?.headers.get('x-ifarm-user-id') ?? null,
        tenantId: cleaned?.headers.get('x-ifarm-tenant-id') ?? null,
        roles: cleaned?.headers.get('x-ifarm-roles') ?? null,
        proxy: cleaned?.headers.get('x-ifarm-proxy-secret') ?? null,
      }),
    })

    expect(await result.json()).toEqual({ userId: null, tenantId: null, roles: null, proxy: null })
  })

  it('substitui headers forjados pelo contexto validado no Core', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/v1/me')) {
        return response({
          id: USER_ID,
          tenantId: TENANT_ID,
          role: 'owner',
          ifarmAdmin: false,
          mfa: { required: true, verified: true, satisfied: true },
        })
      }
      if (url.endsWith('/api/v1/me/permissions')) {
        return response({ permissions: ['user.read', 'configuration.manage'] })
      }
      return response({}, 404)
    }))

    const request = new Request('https://academy.test/api/reviews', {
      headers: {
        authorization: 'Bearer valid-core-token',
        'x-ifarm-user-id': 'forged-user',
        'x-ifarm-tenant-id': 'forged-tenant',
        'x-ifarm-roles': 'ifarm_admin',
        'x-ifarm-core-role': 'forged-role',
      },
    })

    const result = await onRequest({
      env: { ACADEMY_CORE_API_URL: 'https://core.ifarm.test', ACADEMY_ADMIN_PROXY_SECRET: 'internal-only' },
      request,
      next: async (trusted) => response({
        userId: trusted?.headers.get('x-ifarm-user-id'),
        tenantId: trusted?.headers.get('x-ifarm-tenant-id'),
        roles: trusted?.headers.get('x-ifarm-roles'),
        coreRole: trusted?.headers.get('x-ifarm-core-role'),
        permissions: trusted?.headers.get('x-ifarm-core-permissions'),
        mfa: trusted?.headers.get('x-ifarm-mfa-satisfied'),
        source: trusted?.headers.get('x-ifarm-identity-source'),
        proxy: trusted?.headers.get('x-ifarm-proxy-secret'),
      }),
    })

    expect(await result.json()).toEqual({
      userId: USER_ID,
      tenantId: TENANT_ID,
      roles: 'core_owner,academy_admin',
      coreRole: 'owner',
      permissions: 'user.read,configuration.manage',
      mfa: 'true',
      source: 'core_api',
      proxy: 'internal-only',
    })
  })

  it('falha fechado quando há Bearer/Core mas o secret interno do bridge não existe', async () => {
    const result = await onRequest({
      env: { ACADEMY_CORE_API_URL: 'https://core.ifarm.test' },
      request: new Request('https://academy.test/api/reviews', { headers: { authorization: 'Bearer token' } }),
      next: async () => response({ shouldNotRun: true }),
    })
    expect(result.status).toBe(503)
    expect(await result.json()).toMatchObject({ error: 'CORE_BRIDGE_NOT_CONFIGURED' })
  })
})
