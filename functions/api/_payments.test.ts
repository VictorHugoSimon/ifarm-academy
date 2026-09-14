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

  it('normalizes only verified provider events with server evidence', () => {
    const valid = normalizeVerifiedPaymentEvent({
      provider: 'Mercado_Pago',
      providerEventId: 'evt-123',
      providerPaymentId: 'pay-456',
      eventType: 'confirmed',
      amountCents: 5990,
      currency: 'brl',
      payloadHash: 'a'.repeat(64),
      verifiedAt: '2026-09-14T18:00:00.000Z',
    })
    expect(valid).toMatchObject({ provider: 'mercado_pago', eventType: 'confirmed', amountCents: 5990, currency: 'BRL' })
    expect(normalizeVerifiedPaymentEvent({ ...valid, payloadHash: 'not-a-hash' })).toBeNull()
    expect(normalizeVerifiedPaymentEvent({ ...valid, amountCents: 0 })).toBeNull()
  })

  it('fails closed while Mercado Pago is not fully configured', () => {
    expect(paymentProviderReadiness({})).toMatchObject({ configured: false, checkoutEnabled: false, provider: 'not_configured' })
    expect(paymentProviderReadiness({ ACADEMY_PAYMENT_PROVIDER: 'mercado_pago', MERCADOPAGO_ACCESS_TOKEN: 'secret' }))
      .toMatchObject({ configured: false, checkoutEnabled: false, webhookVerificationEnabled: false })
    expect(paymentProviderReadiness({ ACADEMY_PAYMENT_PROVIDER: 'mercado_pago', MERCADOPAGO_ACCESS_TOKEN: 'secret', MERCADOPAGO_WEBHOOK_SECRET: 'webhook' }))
      .toMatchObject({ configured: true, checkoutEnabled: true, webhookVerificationEnabled: true })
  })

  it('never activates a paid entitlement from payment state alone', () => {
    expect(canActivatePaidEntitlement({ paymentStatus: 'confirmed', subscriptionStatus: 'pending_payment', activationReference: 'webhook:evt' })).toBe(false)
    expect(canActivatePaidEntitlement({ paymentStatus: 'confirmed', subscriptionStatus: 'active', activationReference: null })).toBe(false)
    expect(canActivatePaidEntitlement({ paymentStatus: 'confirmed', subscriptionStatus: 'active', activationReference: 'webhook:evt' })).toBe(true)
  })
})
