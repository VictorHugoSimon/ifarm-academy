import { describe, expect, it } from 'vitest'
import { addBillingIntervalUtc, deriveVerifiedBillingPeriod } from './_billingPeriod'

describe('verified billing period', () => {
  it('clamps monthly renewal to the last valid calendar day', () => {
    expect(addBillingIntervalUtc('2027-01-31T18:00:00.000Z', 'monthly')).toBe('2027-02-28T18:00:00.000Z')
    expect(addBillingIntervalUtc('2028-01-31T18:00:00.000Z', 'monthly')).toBe('2028-02-29T18:00:00.000Z')
  })

  it('clamps leap-day annual renewal in a non-leap year', () => {
    expect(addBillingIntervalUtc('2028-02-29T10:15:30.000Z', 'annual')).toBe('2029-02-28T10:15:30.000Z')
  })

  it('derives end from immutable cadence while preserving provider period as evidence only', () => {
    expect(deriveVerifiedBillingPeriod({
      billingInterval: 'monthly',
      providerPeriodStart: '2026-09-30T12:00:00-03:00',
      providerPeriodEnd: '2026-10-31T15:00:00.000Z',
      providerOccurredAt: '2026-09-30T14:59:00.000Z',
    })).toEqual({
      billingInterval: 'monthly',
      periodStart: '2026-09-30T15:00:00.000Z',
      periodEnd: '2026-10-30T15:00:00.000Z',
      startSource: 'provider_period_start',
      endSource: 'academy_derived_from_checkout_interval',
      providerReportedPeriodStart: '2026-09-30T15:00:00.000Z',
      providerReportedPeriodEnd: '2026-10-31T15:00:00.000Z',
      providerPeriodEndMatches: false,
    })
  })

  it('uses verified provider occurrence when no provider period start exists', () => {
    expect(deriveVerifiedBillingPeriod({
      billingInterval: 'annual',
      providerOccurredAt: '2026-09-17T20:00:00.000Z',
    })).toMatchObject({
      periodStart: '2026-09-17T20:00:00.000Z',
      periodEnd: '2027-09-17T20:00:00.000Z',
      startSource: 'provider_occurred_at',
      endSource: 'academy_derived_from_checkout_interval',
      providerPeriodEndMatches: null,
    })
  })

  it('fails closed without canonical timing evidence or a supported cadence', () => {
    expect(deriveVerifiedBillingPeriod({ billingInterval: 'monthly' })).toBeNull()
    expect(deriveVerifiedBillingPeriod({ billingInterval: 'weekly', providerOccurredAt: '2026-09-17T20:00:00.000Z' })).toBeNull()
  })
})
