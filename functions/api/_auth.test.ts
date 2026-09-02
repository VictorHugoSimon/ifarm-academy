import { describe, expect, it } from 'vitest'
import { requireAdminContext } from './_auth'

describe('admin identity boundary', () => {
  const secret = 'stage-secret-value'

  it('falha fechado quando o boundary não está configurado', async () => {
    const result = requireAdminContext({}, new Request('https://academy.test/api/reviews'), ['academy_admin'])
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(503)
  })

  it('rejeita segredo inválido', () => {
    const request = new Request('https://academy.test/api/reviews', {
      headers: {
        'x-ifarm-proxy-secret': 'wrong',
        'x-ifarm-user-id': 'user-1',
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
        'x-ifarm-roles': 'student,producer',
      },
    })
    const result = requireAdminContext({ ACADEMY_ADMIN_PROXY_SECRET: secret }, request, ['academy_admin'])
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(403)
  })

  it('aceita identidade injetada pelo proxy confiável com papel permitido', () => {
    const request = new Request('https://academy.test/api/reviews', {
      headers: {
        'x-ifarm-proxy-secret': secret,
        'x-ifarm-user-id': 'admin-1',
        'x-ifarm-tenant-id': 'tenant-1',
        'x-ifarm-roles': 'academy_reviewer, academy_admin',
      },
    })
    const result = requireAdminContext({ ACADEMY_ADMIN_PROXY_SECRET: secret }, request, ['academy_admin'])
    expect(result).not.toBeInstanceOf(Response)
    expect(result).toEqual({
      userId: 'admin-1',
      tenantId: 'tenant-1',
      roles: ['academy_reviewer', 'academy_admin'],
    })
  })
})
