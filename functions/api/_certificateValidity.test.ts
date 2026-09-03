import { describe, expect, it } from 'vitest'
import {
  addMonthsClamped,
  certificateEffectiveStatus,
  snapshotCertificateValidity,
  validateValidityPolicyInput,
} from './_certificateValidity'

describe('certificate validity rules', () => {
  it('clamps month-end dates safely', () => {
    expect(addMonthsClamped('2026-01-31T12:00:00.000Z', 1)).toBe('2026-02-28T12:00:00.000Z')
    expect(addMonthsClamped('2024-01-31T12:00:00.000Z', 1)).toBe('2024-02-29T12:00:00.000Z')
  })

  it('keeps missing policy explicit instead of assuming indefinite validity', () => {
    const result = snapshotCertificateValidity('2026-09-02T12:00:00.000Z', null)
    expect(result.validityMode).toBe('not_configured')
    expect(result.validUntil).toBeNull()
    expect(result.validityPolicyVersion).toBeNull()
  })

  it('snapshots fixed-month and indefinite policies', () => {
    const fixed = snapshotCertificateValidity('2026-01-31T12:00:00.000Z', {
      id: 'P1', tenant_id: 'T1', course_id: 'C1', validity_mode: 'fixed_months',
      validity_months: 12, source_reference: 'Política interna aprovada', note: 'Regra validada',
      version: 3, confirmed_by: 'ADMIN', confirmed_at: '2026-01-01T00:00:00.000Z',
    })
    expect(fixed.validUntil).toBe('2027-01-31T12:00:00.000Z')
    expect(fixed.validityPolicyVersion).toBe(3)

    const indefinite = snapshotCertificateValidity('2026-01-31T12:00:00.000Z', {
      id: 'P2', tenant_id: 'T1', course_id: 'C1', validity_mode: 'indefinite',
      validity_months: null, source_reference: 'Política aprovada', note: 'Sem prazo definido',
      version: 1, confirmed_by: 'ADMIN', confirmed_at: '2026-01-01T00:00:00.000Z',
    })
    expect(indefinite.validityMode).toBe('indefinite')
    expect(indefinite.validUntil).toBeNull()
  })

  it('computes effective public status without mutating stored status', () => {
    const now = new Date('2026-09-02T12:00:00.000Z')
    expect(certificateEffectiveStatus('revoked', null, now)).toBe('revoked')
    expect(certificateEffectiveStatus('valid', '2026-09-01T12:00:00.000Z', now)).toBe('expired')
    expect(certificateEffectiveStatus('valid', '2026-10-01T12:00:00.000Z', now)).toBe('valid')
    expect(certificateEffectiveStatus('valid', null, now)).toBe('valid')
  })

  it('requires explicit confirmation and a policy source', () => {
    expect(validateValidityPolicyInput({ mode: 'fixed_months', validityMonths: 12, sourceReference: 'Norma', note: 'Validado', confirmed: false }).ok).toBe(false)
    expect(validateValidityPolicyInput({ mode: 'fixed_months', validityMonths: 0, sourceReference: 'Norma', note: 'Validado', confirmed: true }).ok).toBe(false)
    expect(validateValidityPolicyInput({ mode: 'fixed_months', validityMonths: 12, sourceReference: 'Norma', note: 'Validado', confirmed: true }).ok).toBe(true)
    expect(validateValidityPolicyInput({ mode: 'indefinite', sourceReference: 'Política', note: 'Decisão registrada', confirmed: true }).ok).toBe(true)
  })
})
