import { describe, expect, it } from 'vitest'
import {
  canActivatePaidEntitlement,
  nextPaymentStatus,
  normalizeVerifiedPaymentEvent,
  paymentProviderReadiness,
} from './_payments'

describe('payment boundary', () => {
  it('allows provider-confirmed progression and refund only after confirmation', () => {
    expect(nextPaymentStatus('pending', 'confirmed')).toBe('confirmed')
    expect(nextPaymentStatus('confirmed', 'refunded')).toBe('refunded')
    expect(() => nextPaymentStatus('confirmed', 'failed')).toThrow(/invalid payment transition/)
    expect(() => nextPaymentStatus('refunded', 'confirmed')).toThrow(/invalid payment transition/)
  })

  it('normalizes confirmed events only with payment/subscription and period evidence', () => {
    const base = {
      provider: 'Mercado_Pago', providerEventId: 'evt-123', providerPaymentId: 'pay-456', providerSubscriptionId: 'sub-789',
      eventType: 'confirmed', amountCents: 5990, currency: 'brl', payloadHash: 'a'.repeat(64),
      verifiedAt: '2026-09-14T18:00:00.000Z', periodStart: '2026-09-14T18:00:00.000Z', periodEnd: '2026-10-14T18:00:00.000Z',
    }
    const valid = normalizeVerifiedPaymentEvent(base)
    expect(valid).toMatchObject({ provider: 'mercado_pago', eventType: 'confirmed', amountCents: 5990, currency: 'BRL', providerSubscriptionId: 'sub-789' })
    expect(normalizeVerifiedPaymentEvent({ ...base, providerSubscriptionId: null })).toBeNull()
    expect(normalizeVerifiedPaymentEvent({ ...base, periodEnd: '2026-08-14T18:00:00.000Z' })).toBeNull()
    expect(normalizeVerifiedPaymentEvent({ ...base, payloadHash: 'not-a-hash' })).toBeNull()
    expect(normalizeVerifiedPaymentEvent({ ...base, amountCents: 0 })).toBeNull()
  })

  it('accepts non-confirmation events without subscription period evidence', () => {
    expect(normalizeVerifiedPaymentEvent({
      provider: 'mercado_pago', providerEventId: 'evt-pending', eventType: 'pending', amountCents: 5990,
      currency: 'BRL', payloadHash: 'b'.repeat(64), verifiedAt: '2026-09-14T18:00:00.000Z',
    })).toMatchObject({ eventType: 'pending' })
  })

  it('enables HMAC and canonical fetch only when their server-side credentials exist', () => {
    expect(paymentProviderReadiness({})).toMatchObject({ credentialsPresent: false, checkoutEnabled: false, provider: 'not_configured' })
    expect(paymentProviderReadiness({ ACADEMY_PAYMENT_PROVIDER: 'mercado_pago', MERCADOPAGO_ACCESS_TOKEN: 'secret' }))
      .toMatchObject({ credentialsPresent: false, checkoutEnabled: false, webhookVerificationEnabled: false, canonicalResourceFetchEnabled: false })
    expect(paymentProviderReadiness({ ACADEMY_PAYMENT_PROVIDER: 'mercado_pago', MERCADOPAGO_WEBHOOK_SECRET: 'webhook' }))
      .toMatchObject({ credentialsPresent: false, checkoutEnabled: false, webhookVerificationEnabled: true, canonicalResourceFetchEnabled: false })
    expect(paymentProviderReadiness({ ACADEMY_PAYMENT_PROVIDER: 'mercado_pago', MERCADOPAGO_ACCESS_TOKEN: 'secret', MERCADOPAGO_WEBHOOK_SECRET: 'webhook' }))
      .toMatchObject({ credentialsPresent: true, checkoutEnabled: false, webhookVerificationEnabled: true, canonicalResourceFetchEnabled: true })
  })

  it('never activates a paid entitlement from payment state alone', () => {
    expect(canActivatePaidEntitlement({ paymentStatus: 'confirmed', subscriptionStatus: 'pending_payment', activationReference: 'webhook:evt' })).toBe(false)
    expect(canActivatePaidEntitlement({ paymentStatus: 'confirmed', subscriptionStatus: 'active', activationReference: null })).toBe(false)
    expect(canActivatePaidEntitlement({ paymentStatus: 'confirmed', subscriptionStatus: 'active', activationReference: 'webhook:evt' })).toBe(true)
  })
})
