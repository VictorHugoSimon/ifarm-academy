import { describe, expect, it } from 'vitest'
import { requireAdminContext, requireTrustedContext } from './_auth'

describe('iFarm identity boundary', () => {
  const secret = 'stage-secret-value'

  it('falha fechado quando o boundary não está configurado', () => {
    const result = requireAdminContext({}, new Request('https://academy.test/api/reviews'), ['academy_admin'])
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(503)
  })

  it('rejeita segredo inválido', () => {
    const request = new Request('https://academy.test/api/reviews', {
      headers: {
        'x-ifarm-proxy-secret': 'wrong',
        'x-ifarm-user-id': 'user-1',
        'x-ifarm-tenant-id': 'tenant-1',
        'x-ifarm-roles': 'academy_admin',
      },
    })
    const result = requireAdminContext({ ACADEMY_ADMIN_PROXY_SECRET: secret }, request, ['academy_admin'])
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('rejeita usuário sem papel permitido', () => {
    const request = new Request('https://academy.test/api/reviews', {
      headers: {
        'x-ifarm-proxy-secret': secret,
        'x-ifarm-user-id': 'user-1',
        'x-ifarm-tenant-id': 'tenant-1',
        'x-ifarm-roles': 'student,producer',
      },
    })
    const result = requireAdminContext({ ACADEMY_ADMIN_PROXY_SECRET: secret }, request, ['academy_admin'])
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(403)
  })

  it('rejeita contexto confiável sem tenant', () => {
    const request = new Request('https://academy.test/api/progress', {
      headers: {
        'x-ifarm-proxy-secret': secret,
        'x-ifarm-user-id': 'student-1',
        'x-ifarm-roles': 'student',
      },
    })
    const result = requireTrustedContext({ ACADEMY_ADMIN_PROXY_SECRET: secret }, request)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('aceita estudante autenticado com tenant e nome confiável', () => {
    const request = new Request('https://academy.test/api/progress', {
      headers: {
        'x-ifarm-proxy-secret': secret,
        'x-ifarm-user-id': 'student-1',
        'x-ifarm-user-name': 'Aluno Teste',
        'x-ifarm-tenant-id': 'tenant-1',
        'x-ifarm-roles': 'student,producer',
      },
    })
    const result = requireTrustedContext({ ACADEMY_ADMIN_PROXY_SECRET: secret }, request)
    expect(result).toEqual({
      userId: 'student-1',
      displayName: 'Aluno Teste',
      tenantId: 'tenant-1',
      roles: ['student', 'producer'],
      permissions: [],
      coreRole: undefined,
      mfaSatisfied: undefined,
      identitySource: 'legacy_proxy',
    })
  })

  it('aceita identidade administrativa injetada pelo proxy confiável', () => {
    const request = new Request('https://academy.test/api/reviews', {
      headers: {
        'x-ifarm-proxy-secret': secret,
        'x-ifarm-user-id': 'admin-1',
        'x-ifarm-tenant-id': 'tenant-1',
        'x-ifarm-roles': 'academy_reviewer, academy_admin',
      },
    })
    const result = requireAdminContext({ ACADEMY_ADMIN_PROXY_SECRET: secret }, request, ['academy_admin'])
    expect(result).toEqual({
      userId: 'admin-1',
      tenantId: 'tenant-1',
      roles: ['academy_reviewer', 'academy_admin'],
      permissions: [],
      coreRole: undefined,
      mfaSatisfied: undefined,
      identitySource: 'legacy_proxy',
    })
  })

  it('expõe permissões, papel Core, MFA e fonte quando o middleware validou a identidade', () => {
    const request = new Request('https://academy.test/api/reviews', {
      headers: {
        'x-ifarm-proxy-secret': secret,
        'x-ifarm-user-id': 'core-user',
        'x-ifarm-tenant-id': 'core-tenant',
        'x-ifarm-roles': 'core_owner,academy_admin',
        'x-ifarm-core-permissions': 'user.read,configuration.manage,user.read',
        'x-ifarm-core-role': 'owner',
        'x-ifarm-mfa-satisfied': 'true',
        'x-ifarm-identity-source': 'core_api',
      },
    })
    const result = requireAdminContext({ ACADEMY_ADMIN_PROXY_SECRET: secret }, request, ['academy_admin'])
    expect(result).toMatchObject({
      userId: 'core-user',
      tenantId: 'core-tenant',
      roles: ['core_owner', 'academy_admin'],
      permissions: ['user.read', 'configuration.manage'],
      coreRole: 'owner',
      mfaSatisfied: true,
      identitySource: 'core_api',
    })
  })
})
