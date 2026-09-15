import { describe, expect, it } from 'vitest'
import { addBillingInterval, deriveBillingPeriodEvidence } from './_billingPeriod'

describe('billing period evidence', () => {
  it('preserva fim de mês ao somar um mês', () => {
    expect(addBillingInterval('2026-01-31T12:34:56.000Z', 'monthly')).toBe('2026-02-28T12:34:56.000Z')
    expect(addBillingInterval('2028-01-31T12:34:56.000Z', 'monthly')).toBe('2028-02-29T12:34:56.000Z')
  })

  it('ajusta 29 de fevereiro ao somar um ano', () => {
    expect(addBillingInterval('2028-02-29T08:00:00.000Z', 'annual')).toBe('2029-02-28T08:00:00.000Z')
  })

  it('prioriza período integral fornecido pelo provider', () => {
    expect(deriveBillingPeriodEvidence({
      providerPeriodStart: '2026-09-15T10:00:00Z',
      providerPeriodEnd: '2026-10-15T10:00:00Z',
      occurredAt: '2026-09-15T10:05:00Z',
      billingInterval: 'monthly',
    })).toMatchObject({
      evidenceType: 'provider_period',
      periodStart: '2026-09-15T10:00:00.000Z',
      periodEnd: '2026-10-15T10:00:00.000Z',
      evidence: { startSource: 'provider_period_start', endSource: 'provider_period_end' },
    })
  })

  it('registra quando somente o fim foi derivado do intervalo local', () => {
    expect(deriveBillingPeriodEvidence({
      providerPeriodStart: '2026-01-31T10:00:00Z',
      providerPeriodEnd: null,
      occurredAt: '2026-01-31T10:00:02Z',
      billingInterval: 'monthly',
    })).toMatchObject({
      evidenceType: 'provider_start_plus_checkout_interval',
      periodEnd: '2026-02-28T10:00:00.000Z',
      evidence: { startSource: 'provider_period_start', endSource: 'checkout_billing_interval' },
    })
  })

  it('explicita quando todo o período parte da ocorrência canônica + intervalo local', () => {
    expect(deriveBillingPeriodEvidence({
      providerPeriodStart: null,
      providerPeriodEnd: null,
      occurredAt: '2026-12-31T23:00:00Z',
      billingInterval: 'monthly',
    })).toMatchObject({
      evidenceType: 'provider_occurrence_plus_checkout_interval',
      periodStart: '2026-12-31T23:00:00.000Z',
      periodEnd: '2027-01-31T23:00:00.000Z',
    })
  })

  it('falha fechado sem evidência de início ou com intervalo inválido', () => {
    expect(deriveBillingPeriodEvidence({ billingInterval: 'monthly' })).toBeNull()
    expect(deriveBillingPeriodEvidence({ occurredAt: '2026-09-15T00:00:00Z', billingInterval: 'weekly' })).toBeNull()
  })
})
