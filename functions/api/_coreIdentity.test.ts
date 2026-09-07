import { describe, expect, it } from 'vitest'
import {
  coreRequestTimeoutMs,
  mapCoreRoleToAcademyRoles,
  normalizeCoreApiUrl,
  resolveCoreIdentity,
  type CoreFetch,
} from './_coreIdentity'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const TENANT_ID = '22222222-2222-4222-8222-222222222222'
const MEMBERSHIP_ID = '33333333-3333-4333-8333-333333333333'
const ROLE_ID = '44444444-4444-4444-8444-444444444444'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

describe('iFarm Core identity adapter', () => {
  it('aceita somente base URL segura', () => {
    expect(normalizeCoreApiUrl('https://core.ifarm.test/')).toBe('https://core.ifarm.test')
    expect(normalizeCoreApiUrl('http://localhost:8787/')).toBe('http://localhost:8787')
    expect(normalizeCoreApiUrl('http://core.ifarm.test')).toBeNull()
    expect(normalizeCoreApiUrl('https://user:pass@core.ifarm.test')).toBeNull()
    expect(normalizeCoreApiUrl('https://core.ifarm.test?token=x')).toBeNull()
  })

  it('limita timeout de integração', () => {
    expect(coreRequestTimeoutMs({ ACADEMY_CORE_REQUEST_TIMEOUT_MS: '50' })).toBe(500)
    expect(coreRequestTimeoutMs({ ACADEMY_CORE_REQUEST_TIMEOUT_MS: '5000' })).toBe(5000)
    expect(coreRequestTimeoutMs({ ACADEMY_CORE_REQUEST_TIMEOUT_MS: '50000' })).toBe(10000)
    expect(coreRequestTimeoutMs({ ACADEMY_CORE_REQUEST_TIMEOUT_MS: 'invalid' })).toBe(4000)
  })

  it('só projeta owner como admin Academy quando MFA está satisfeito', () => {
    expect(mapCoreRoleToAcademyRoles({ coreRole: 'owner', isIfarmAdmin: false, mfaSatisfied: false }))
      .toEqual(['core_owner'])
    expect(mapCoreRoleToAcademyRoles({ coreRole: 'owner', isIfarmAdmin: false, mfaSatisfied: true }))
      .toEqual(['core_owner', 'academy_admin'])
  })

  it('projeta administrador iFarm somente com MFA satisfeito', () => {
    expect(mapCoreRoleToAcademyRoles({ coreRole: 'manager', isIfarmAdmin: true, mfaSatisfied: true }))
      .toEqual(['core_manager', 'ifarm_admin', 'academy_admin', 'academy_manager'])
    expect(mapCoreRoleToAcademyRoles({ coreRole: 'manager', isIfarmAdmin: true, mfaSatisfied: false }))
      .toEqual(['core_manager', 'academy_manager'])
  })

  it('resolve identidade e permissões usando os endpoints reais do contrato Core v1', async () => {
    const calls: string[] = []
    const fetcher: CoreFetch = async (input, init) => {
      const url = String(input)
      calls.push(url)
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token-ok')
      if (url.endsWith('/api/v1/me')) {
        return jsonResponse({
          id: USER_ID,
          tenantId: TENANT_ID,
          membershipId: MEMBERSHIP_ID,
          roleId: ROLE_ID,
          role: 'tenant_admin',
          ifarmAdmin: false,
          mfa: { required: true, verified: true, satisfied: true },
          requestId: 'core-request-1',
        })
      }
      if (url.endsWith('/api/v1/me/permissions')) {
        return jsonResponse({ permissions: ['user.read', 'configuration.manage', 'user.read'] })
      }
      return jsonResponse({}, 404)
    }

    const request = new Request('https://academy.test/api/reviews', {
      headers: { authorization: 'Bearer token-ok' },
    })
    const result = await resolveCoreIdentity({ ACADEMY_CORE_API_URL: 'https://core.ifarm.test' }, request, fetcher)
    expect(result).not.toBeInstanceOf(Response)
    expect(result).toMatchObject({
      userId: USER_ID,
      tenantId: TENANT_ID,
      membershipId: MEMBERSHIP_ID,
      roleId: ROLE_ID,
      coreRole: 'tenant_admin',
      roles: ['core_tenant_admin', 'academy_admin'],
      permissions: ['user.read', 'configuration.manage'],
      isIfarmAdmin: false,
      mfaRequired: true,
      mfaVerified: true,
      mfaSatisfied: true,
      identitySource: 'core_api',
      coreRequestId: 'core-request-1',
    })
    expect(calls).toEqual([
      'https://core.ifarm.test/api/v1/me',
      'https://core.ifarm.test/api/v1/me/permissions',
    ])
  })

  it('falha fechado quando o Core não retorna tenant ativo', async () => {
    const fetcher: CoreFetch = async () => jsonResponse({
      id: USER_ID,
      tenantId: null,
      role: 'owner',
      ifarmAdmin: false,
      mfa: { required: true, verified: true, satisfied: true },
    })
    const result = await resolveCoreIdentity(
      { ACADEMY_CORE_API_URL: 'https://core.ifarm.test' },
      new Request('https://academy.test/api/me', { headers: { authorization: 'Bearer token-ok' } }),
      fetcher,
    )
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(409)
  })

  it('propaga falha de autenticação sem cair no proxy legado', async () => {
    const fetcher: CoreFetch = async () => jsonResponse({ error: 'AUTH_REQUIRED' }, 401)
    const result = await resolveCoreIdentity(
      { ACADEMY_CORE_API_URL: 'https://core.ifarm.test' },
      new Request('https://academy.test/api/me', { headers: { authorization: 'Bearer expired' } }),
      fetcher,
    )
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })
})
