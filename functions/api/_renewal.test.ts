import { describe, expect, it } from 'vitest'
import { addMonthsClampedIso, evaluateRenewal, normalizeRenewalMonths } from './_renewal'

describe('enterprise training renewal rules', () => {
  it('clamps end-of-month dates instead of overflowing to the next month', () => {
    expect(addMonthsClampedIso('2026-01-31T12:00:00.000Z', 1)).toBe('2026-02-28T12:00:00.000Z')
    expect(addMonthsClampedIso('2028-01-31T12:00:00.000Z', 1)).toBe('2028-02-29T12:00:00.000Z')
  })

  it('classifies due, upcoming and future renewal states', () => {
    expect(evaluateRenewal('2025-09-01T00:00:00.000Z', 12, '2026-09-02T00:00:00.000Z').state).toBe('due')
    expect(evaluateRenewal('2025-09-20T00:00:00.000Z', 12, '2026-09-02T00:00:00.000Z').state).toBe('upcoming')
    expect(evaluateRenewal('2026-01-01T00:00:00.000Z', 12, '2026-09-02T00:00:00.000Z').state).toBe('not_due')
  })

  it('requires explicit positive renewal months and does not infer regulation', () => {
    expect(normalizeRenewalMonths(null)).toBeNull()
    expect(normalizeRenewalMonths('')).toBeNull()
    expect(normalizeRenewalMonths(12)).toBe(12)
    expect(normalizeRenewalMonths(0)).toBeUndefined()
    expect(normalizeRenewalMonths('NR-31')).toBeUndefined()
    expect(evaluateRenewal('2026-01-01T00:00:00.000Z', null).state).toBe('not_configured')
  })
})
