import { describe, expect, it, vi } from 'vitest'
import {
  fetchMercadoPagoCanonicalResource,
  mapMercadoPagoPaymentStatus,
  mercadoPagoCanonicalPath,
  mercadoPagoRequestTimeoutMs,
} from './_mercadoPagoProvider'

const PAYMENT = {
  id: 123456789,
  status: 'approved',
  status_detail: 'accredited',
  external_reference: '11111111-1111-4111-8111-111111111111',
  transaction_amount: 59.9,
  currency_id: 'BRL',
  date_approved: '2026-09-15T12:00:00.000Z',
  date_last_updated: '2026-09-15T12:01:00.000Z',
  payer: { email: 'never-persist@example.test', identification: { number: 'secret' } },
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

describe('Mercado Pago canonical resource adapter', () => {
  it('uses only fixed official resource paths', () => {
    expect(mercadoPagoCanonicalPath('payment', '123')).toBe('/v1/payments/123')
    expect(mercadoPagoCanonicalPath('subscription_preapproval', 'abc-123')).toBe('/preapproval/abc-123')
    expect(mercadoPagoCanonicalPath('subscription_authorized_payment', '456')).toBe('/authorized_payments/456')
    expect(mercadoPagoCanonicalPath('unknown', '123')).toBeNull()
    expect(mercadoPagoCanonicalPath('payment', '../escape')).toBeNull()
  })

  it('maps provider payment statuses conservatively', () => {
    expect(mapMercadoPagoPaymentStatus('approved')).toBe('confirmed')
    expect(mapMercadoPagoPaymentStatus('pending')).toBe('pending')
    expect(mapMercadoPagoPaymentStatus('in_process')).toBe('pending')
    expect(mapMercadoPagoPaymentStatus('rejected')).toBe('failed')
    expect(mapMercadoPagoPaymentStatus('cancelled')).toBe('cancelled')
    expect(mapMercadoPagoPaymentStatus('refunded')).toBe('refunded')
    expect(mapMercadoPagoPaymentStatus('mystery')).toBeNull()
  })

  it('normalizes timeout bounds', () => {
    expect(mercadoPagoRequestTimeoutMs({ MERCADOPAGO_REQUEST_TIMEOUT_MS: '100' })).toBe(750)
    expect(mercadoPagoRequestTimeoutMs({ MERCADOPAGO_REQUEST_TIMEOUT_MS: '99999' })).toBe(10_000)
    expect(mercadoPagoRequestTimeoutMs({ MERCADOPAGO_REQUEST_TIMEOUT_MS: 'bad' })).toBe(5000)
  })

  it('fails closed without a server-side access token', async () => {
    const fetcher = vi.fn()
    await expect(fetchMercadoPagoCanonicalResource({}, 'payment', '123', fetcher)).resolves.toEqual({
      ok: false, code: 'provider_not_configured', retryable: true,
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('fetches the canonical payment with Bearer and returns only normalized evidence', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.mercadopago.com/v1/payments/123456789')
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer server-token')
      return json(PAYMENT)
    })
    const result = await fetchMercadoPagoCanonicalResource(
      { MERCADOPAGO_ACCESS_TOKEN: 'server-token' }, 'payment', '123456789', fetcher,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.resource).toMatchObject({
      resourceType: 'payment',
      resourceId: '123456789',
      canonicalStatus: 'approved',
      externalReference: '11111111-1111-4111-8111-111111111111',
      amountCents: 5990,
      currency: 'BRL',
      providerPaymentId: '123456789',
      eventType: 'confirmed',
      occurredAt: '2026-09-15T12:00:00.000Z',
    })
    expect(JSON.stringify(result.resource)).not.toContain('never-persist@example.test')
    expect(result.resource.payloadHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('normalizes authorized subscription payments with preapproval evidence', async () => {
    const result = await fetchMercadoPagoCanonicalResource(
      { MERCADOPAGO_ACCESS_TOKEN: 'token' },
      'subscription_authorized_payment',
      '6114264375',
      async () => json({
        id: 6114264375,
        preapproval_id: '2c938084726fca480172750000000000',
        external_reference: '11111111-1111-4111-8111-111111111111',
        currency_id: 'BRL',
        transaction_amount: '24.50',
        debit_date: '2026-09-15T12:00:00.000Z',
        summarized: 'pending',
        payment: { id: 19951521071, status: 'approved', status_detail: 'accredited' },
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.resource).toMatchObject({
      resourceType: 'authorized_payment',
      amountCents: 2450,
      currency: 'BRL',
      providerPaymentId: '19951521071',
      providerSubscriptionId: '2c938084726fca480172750000000000',
      eventType: 'confirmed',
      periodStart: '2026-09-15T12:00:00.000Z',
    })
  })

  it('classifies provider failures without leaking token', async () => {
    const auth = await fetchMercadoPagoCanonicalResource(
      { MERCADOPAGO_ACCESS_TOKEN: 'super-secret' }, 'payment', '123', async () => json({}, 401),
    )
    expect(auth).toEqual({ ok: false, code: 'provider_auth_failed', retryable: true, httpStatus: 401 })
    expect(JSON.stringify(auth)).not.toContain('super-secret')

    const missing = await fetchMercadoPagoCanonicalResource(
      { MERCADOPAGO_ACCESS_TOKEN: 'token' }, 'payment', '123', async () => json({}, 404),
    )
    expect(missing).toEqual({ ok: false, code: 'provider_resource_not_found', retryable: true, httpStatus: 404 })
  })

  it('rejects a canonical response whose resource id does not match the notification', async () => {
    const result = await fetchMercadoPagoCanonicalResource(
      { MERCADOPAGO_ACCESS_TOKEN: 'token' }, 'payment', '123', async () => json({ ...PAYMENT, id: 999 }),
    )
    expect(result).toMatchObject({ ok: false, code: 'provider_resource_mismatch', retryable: false })
  })
})
