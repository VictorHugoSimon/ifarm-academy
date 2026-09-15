import { describe, expect, it, vi } from 'vitest'
import {
  createMercadoPagoPendingSubscription,
  mercadoPagoCheckoutEnabled,
  resolveCorePayerEmail,
} from './_mercadoPagoCheckout'

const CHECKOUT_ID = '11111111-1111-4111-8111-111111111111'

const env = {
  ACADEMY_PAYMENT_PROVIDER: 'mercado_pago',
  ACADEMY_PAYMENT_CHECKOUT_ENABLED: 'true',
  ACADEMY_PAYMENT_RETURN_URL: 'https://academy.ifarm.agr.br/app/payment-return',
  MERCADOPAGO_ACCESS_TOKEN: 'server-secret-token',
  MERCADOPAGO_WEBHOOK_SECRET: 'server-webhook-secret',
  ACADEMY_CORE_API_URL: 'https://core.ifarm.agr.br',
  ACADEMY_CORE_REQUEST_TIMEOUT_MS: '1000',
}

function providerResponse(overrides: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({
    id: 'preapproval-123',
    init_point: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=preapproval-123',
    external_reference: CHECKOUT_ID,
    status: 'pending',
    auto_recurring: { transaction_amount: 59.9, currency_id: 'BRL' },
    ...overrides,
  }), { status: 201, headers: { 'content-type': 'application/json' } })
}

describe('Mercado Pago checkout creation', () => {
  it('fica fail-closed sem feature flag explícita', async () => {
    const fetcher = vi.fn()
    const result = await createMercadoPagoPendingSubscription(
      { ...env, ACADEMY_PAYMENT_CHECKOUT_ENABLED: 'false' },
      {
        checkoutId: CHECKOUT_ID,
        idempotencyKey: CHECKOUT_ID,
        planName: 'Plano Pro',
        billingInterval: 'monthly',
        amountCents: 5990,
        currency: 'BRL',
        payerEmail: 'aluno@ifarm.agr.br',
      },
      fetcher,
    )
    expect(result).toMatchObject({ ok: false, code: 'checkout_disabled' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('cria assinatura pendente usando snapshot server-side e chave idempotente', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(_input)).toBe('https://api.mercadopago.com/preapproval')
      const headers = new Headers(init?.headers)
      expect(headers.get('authorization')).toBe('Bearer server-secret-token')
      expect(headers.get('x-idempotency-key')).toBe(CHECKOUT_ID)
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({
        reason: 'Plano Pro',
        external_reference: CHECKOUT_ID,
        payer_email: 'aluno@ifarm.agr.br',
        back_url: 'https://academy.ifarm.agr.br/app/payment-return',
        status: 'pending',
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 59.9, currency_id: 'BRL' },
      })
      return providerResponse()
    })
    const result = await createMercadoPagoPendingSubscription(env, {
      checkoutId: CHECKOUT_ID,
      idempotencyKey: CHECKOUT_ID,
      planName: 'Plano Pro',
      billingInterval: 'monthly',
      amountCents: 5990,
      currency: 'BRL',
      payerEmail: 'aluno@ifarm.agr.br',
    }, fetcher)
    expect(result).toMatchObject({
      ok: true,
      resourceId: 'preapproval-123',
      providerStatus: 'pending',
      externalReference: CHECKOUT_ID,
    })
    expect(mercadoPagoCheckoutEnabled(env)).toBe(true)
  })

  it('rejeita resposta canônica de criação com valor divergente', async () => {
    const result = await createMercadoPagoPendingSubscription(env, {
      checkoutId: CHECKOUT_ID,
      idempotencyKey: CHECKOUT_ID,
      planName: 'Plano Pro',
      billingInterval: 'annual',
      amountCents: 59900,
      currency: 'BRL',
      payerEmail: 'aluno@ifarm.agr.br',
    }, async () => providerResponse())
    expect(result).toMatchObject({ ok: false, code: 'provider_resource_mismatch' })
  })

  it('obtém payer email somente do /api/v1/me do Core usando o Bearer original', async () => {
    const request = new Request('https://academy.ifarm.agr.br/api/checkout-provider', {
      headers: { authorization: 'Bearer user-core-token' },
    })
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://core.ifarm.agr.br/api/v1/me')
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer user-core-token')
      return Response.json({ id: '22222222-2222-4222-8222-222222222222', email: 'Aluno@iFarm.agr.br' })
    })
    const result = await resolveCorePayerEmail(env, request, fetcher)
    expect(result).toEqual({ ok: true, email: 'aluno@ifarm.agr.br' })
  })
})
