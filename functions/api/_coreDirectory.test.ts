import { describe, expect, it } from 'vitest'
import { loadCoreMembershipDirectory, resolveCoreMembership } from './_coreDirectory'
import type { CoreFetch } from './_coreIdentity'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222'
const MEMBERSHIP_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '44444444-4444-4444-8444-444444444444'

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

function request() {
  return new Request('https://academy.test/api/core-memberships', {
    headers: { authorization: 'Bearer core-token' },
  })
}

describe('Core membership directory adapter', () => {
  it('returns only active memberships from the expected tenant', async () => {
    const fetcher: CoreFetch = async (_input, init) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer core-token')
      return response({ memberships: [
        {
          id: MEMBERSHIP_ID,
          tenant_id: TENANT_ID,
          organization_id: null,
          user_id: USER_ID,
          role_id: '55555555-5555-4555-8555-555555555555',
          role_code: 'manager',
          status: 'active',
          user_name: 'Pessoa Core',
          user_email: 'pessoa@ifarm.test',
        },
        {
          id: '66666666-6666-4666-8666-666666666666',
          tenant_id: OTHER_TENANT,
          user_id: '77777777-7777-4777-8777-777777777777',
          role_code: 'manager',
          status: 'active',
        },
        {
          id: '88888888-8888-4888-8888-888888888888',
          tenant_id: TENANT_ID,
          user_id: '99999999-9999-4999-8999-999999999999',
          role_code: 'operator',
          status: 'suspended',
        },
      ] })
    }

    const result = await loadCoreMembershipDirectory(
      { ACADEMY_CORE_API_URL: 'https://core.ifarm.test' },
      request(),
      TENANT_ID,
      fetcher,
    )
    expect(result).not.toBeInstanceOf(Response)
    expect(result).toEqual([{
      membershipId: MEMBERSHIP_ID,
      tenantId: TENANT_ID,
      organizationId: null,
      userId: USER_ID,
      displayName: 'Pessoa Core',
      email: 'pessoa@ifarm.test',
      roleCode: 'manager',
      status: 'active',
    }])
  })

  it('fails closed when Core denies user directory access', async () => {
    const fetcher: CoreFetch = async () => response({ error: 'forbidden' }, 403)
    const result = await loadCoreMembershipDirectory(
      { ACADEMY_CORE_API_URL: 'https://core.ifarm.test' },
      request(),
      TENANT_ID,
      fetcher,
    )
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(403)
  })

  it('resolves a membership by Core membership id and rejects unknown id', async () => {
    const fetcher: CoreFetch = async () => response({ memberships: [{
      id: MEMBERSHIP_ID,
      tenant_id: TENANT_ID,
      organization_id: null,
      user_id: USER_ID,
      role_code: 'operator',
      status: 'active',
      user_name: 'Pessoa Core',
    }] })
    const found = await resolveCoreMembership(
      { ACADEMY_CORE_API_URL: 'https://core.ifarm.test' }, request(), TENANT_ID, MEMBERSHIP_ID, fetcher,
    )
    expect(found).not.toBeInstanceOf(Response)
    expect(found).toMatchObject({ membershipId: MEMBERSHIP_ID, userId: USER_ID })

    const missing = await resolveCoreMembership(
      { ACADEMY_CORE_API_URL: 'https://core.ifarm.test' },
      request(),
      TENANT_ID,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      fetcher,
    )
    expect(missing).toBeInstanceOf(Response)
    expect((missing as Response).status).toBe(404)
  })
})
