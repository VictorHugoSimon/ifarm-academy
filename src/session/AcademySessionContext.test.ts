import { describe, expect, it } from 'vitest'
import { deriveAcademySessionAccess } from './AcademySessionContext'
import type { CoreSessionSnapshot } from '../services/coreSessionApi'

function snapshot(overrides: Partial<CoreSessionSnapshot> = {}): CoreSessionSnapshot {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    role: 'operator',
    ifarmAdmin: false,
    mfa: { required: false, verified: false, satisfied: false },
    permissions: [],
    tenants: [],
    ...overrides,
  }
}

describe('Academy session privilege projection', () => {
  it('não eleva papel comum', () => {
    const access = deriveAcademySessionAccess(snapshot())
    expect(access.academyAdmin).toBe(false)
    expect(access.enterpriseManager).toBe(false)
    expect(access.ifarmOperations).toBe(false)
  })

  it('permite owner/tenant_admin somente com MFA satisfeito quando exigido', () => {
    expect(deriveAcademySessionAccess(snapshot({ role: 'owner', mfa: { required: true, verified: true, satisfied: false } })).academyAdmin).toBe(false)
    expect(deriveAcademySessionAccess(snapshot({ role: 'owner', mfa: { required: true, verified: true, satisfied: true } })).academyAdmin).toBe(true)
  })

  it('projeta gestão empresarial somente quando as capabilities Core estão presentes', () => {
    const permissions = ['organization.manage', 'user.manage', 'notification.manage']
    const access = deriveAcademySessionAccess(snapshot({ role: 'manager', permissions }))
    expect(access.enterpriseManager).toBe(true)
    expect(access.academyAdmin).toBe(false)
  })

  it('não libera gestão empresarial por role manager sem todas as permissions', () => {
    const access = deriveAcademySessionAccess(snapshot({
      role: 'manager',
      permissions: ['organization.manage', 'user.manage'],
    }))
    expect(access.enterpriseManager).toBe(false)
  })

  it('bloqueia gestão empresarial quando MFA exigido ainda não está satisfeito', () => {
    const access = deriveAcademySessionAccess(snapshot({
      role: 'manager',
      permissions: ['organization.manage', 'user.manage', 'notification.manage'],
      mfa: { required: true, verified: true, satisfied: false },
    }))
    expect(access.enterpriseManager).toBe(false)
  })

  it('reserva Operações para ifarm_admin com MFA satisfeito', () => {
    expect(deriveAcademySessionAccess(snapshot({ ifarmAdmin: true, mfa: { required: true, verified: true, satisfied: false } })).ifarmOperations).toBe(false)
    expect(deriveAcademySessionAccess(snapshot({ ifarmAdmin: true, mfa: { required: true, verified: true, satisfied: true } })).ifarmOperations).toBe(true)
  })
})
