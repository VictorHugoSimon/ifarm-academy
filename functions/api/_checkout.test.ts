import { describe, expect, it } from 'vitest'
import { normalizeIdempotencyKey, parseCheckoutItems, summarizeResolvedItems } from './_checkout'

describe('checkout safety helpers', () => {
  it('exige idempotency key segura', () => {
    expect(normalizeIdempotencyKey('checkout:abc-123')).toBe('checkout:abc-123')
    expect(normalizeIdempotencyKey('short')).toBeNull()
    expect(normalizeIdempotencyKey('unsafe key with spaces')).toBeNull()
  })

  it('não aceita preço enviado pelo navegador e valida apenas identidade/quantidade', () => {
    const items = parseCheckoutItems([
      { productType: 'course', productId: 'C1', quantity: 1, unitAmountCents: 1 },
      { productType: 'plan', productId: 'P1', billingInterval: 'monthly', quantity: 3, unitAmountCents: 1 },
    ])
    expect(items).toEqual([
      { productType: 'course', productId: 'C1', quantity: 1, billingInterval: undefined },
      { productType: 'plan', productId: 'P1', billingInterval: 'monthly', quantity: 3 },
    ])
  })

  it('rejeita item duplicado e intervalo em produto que não é plano', () => {
    expect(() => parseCheckoutItems([
      { productType: 'course', productId: 'C1' },
      { productType: 'course', productId: 'C1' },
    ])).toThrow('checkout_duplicate_item')
    expect(() => parseCheckoutItems([
      { productType: 'event', productId: 'E1', billingInterval: 'monthly' },
    ])).toThrow('checkout_interval_not_allowed')
  })

  it('rejeita carrinho multi-moeda e calcula total somente de snapshots resolvidos', () => {
    expect(() => summarizeResolvedItems([
      { productType: 'course', productId: 'C1', quantity: 1, priceRef: null, description: 'Curso', unitAmountCents: 1000, totalAmountCents: 1000, currency: 'BRL' },
      { productType: 'event', productId: 'E1', quantity: 1, priceRef: null, description: 'Evento', unitAmountCents: 1000, totalAmountCents: 1000, currency: 'USD' },
    ])).toThrow('checkout_mixed_currency')

    expect(summarizeResolvedItems([
      { productType: 'plan', productId: 'P1', billingInterval: 'monthly', quantity: 2, priceRef: 'PP1', description: 'Plano', unitAmountCents: 2500, totalAmountCents: 5000, currency: 'BRL' },
    ])).toEqual({ currency: 'BRL', totalAmountCents: 5000, itemCount: 1 })
  })
})
