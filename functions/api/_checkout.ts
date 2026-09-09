export type CheckoutProductType = 'course' | 'plan' | 'event'

export interface CheckoutRequestItem {
  productType: CheckoutProductType
  productId: string
  billingInterval?: 'monthly' | 'annual'
  quantity: number
}

export interface ResolvedCheckoutItem extends CheckoutRequestItem {
  priceRef: string | null
  description: string
  unitAmountCents: number
  totalAmountCents: number
  currency: string
}

const IDEMPOTENCY_RE = /^[A-Za-z0-9._:-]{8,120}$/

export function normalizeIdempotencyKey(value: string | null): string | null {
  const key = value?.trim() ?? ''
  return IDEMPOTENCY_RE.test(key) ? key : null
}

export function parseCheckoutItems(value: unknown): CheckoutRequestItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error('checkout_items_invalid')
  const seen = new Set<string>()
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('checkout_item_invalid')
    const item = raw as Record<string, unknown>
    const productType = String(item.productType ?? '') as CheckoutProductType
    if (!['course', 'plan', 'event'].includes(productType)) throw new Error('checkout_product_type_invalid')
    const productId = String(item.productId ?? '').trim()
    if (!productId || productId.length > 160) throw new Error('checkout_product_id_invalid')
    const quantity = item.quantity == null ? 1 : Number(item.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw new Error('checkout_quantity_invalid')
    const billingInterval = item.billingInterval == null ? undefined : String(item.billingInterval)
    if (productType === 'plan' && billingInterval !== 'monthly' && billingInterval !== 'annual') {
      throw new Error('checkout_plan_interval_required')
    }
    if (productType !== 'plan' && billingInterval != null) throw new Error('checkout_interval_not_allowed')
    const identity = `${productType}:${productId}:${billingInterval ?? ''}`
    if (seen.has(identity)) throw new Error('checkout_duplicate_item')
    seen.add(identity)
    return { productType, productId, billingInterval: billingInterval as 'monthly' | 'annual' | undefined, quantity }
  })
}

export function summarizeResolvedItems(items: ResolvedCheckoutItem[]) {
  if (!items.length) throw new Error('checkout_items_empty')
  const currencies = new Set(items.map((item) => item.currency))
  if (currencies.size !== 1) throw new Error('checkout_mixed_currency')
  const totalAmountCents = items.reduce((sum, item) => sum + item.totalAmountCents, 0)
  if (!Number.isSafeInteger(totalAmountCents) || totalAmountCents <= 0) throw new Error('checkout_total_invalid')
  return {
    currency: items[0].currency,
    totalAmountCents,
    itemCount: items.length,
  }
}
