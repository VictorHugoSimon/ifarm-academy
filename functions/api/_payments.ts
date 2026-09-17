import type { Env } from './_shared'

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'refunded'
export type VerifiedPaymentEventType = PaymentStatus

export interface VerifiedPaymentEventInput {
  provider: string
  providerEventId: string
  providerPaymentId?: string | null
  providerSubscriptionId?: string | null
  eventType: VerifiedPaymentEventType
  amountCents: number
  currency: string
  payloadHash: string
  verifiedAt: string
  providerOccurredAt?: string | null
  periodStart?: string | null
  periodEnd?: string | null
}

const TRANSITIONS: Record<PaymentStatus, ReadonlySet<PaymentStatus>> = {
  pending: new Set(['pending','confirmed','failed','cancelled']),
  failed: new Set(['failed','pending','confirmed','cancelled']),
  confirmed: new Set(['confirmed','refunded']),
  cancelled: new Set(['cancelled']),
  refunded: new Set(['refunded']),
}

export function nextPaymentStatus(current: PaymentStatus, eventType: VerifiedPaymentEventType): PaymentStatus {
  if (!TRANSITIONS[current].has(eventType)) throw new Error(`invalid payment transition: ${current} -> ${eventType}`)
  return eventType
}

export function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const currency = value.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(currency) ? currency : null
}

export function normalizePaymentReturnUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    const local = ['localhost','127.0.0.1','::1'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
    if (url.username || url.password || url.hash) return null
    return url.toString()
  } catch {
    return null
  }
}

function optionalString(value: unknown, max = 180): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text && text.length <= max ? text : null
}

function validIso(value: string | null): boolean {
  return Boolean(value && !Number.isNaN(Date.parse(value)))
}

export function normalizeVerifiedPaymentEvent(input: Record<string, unknown>): VerifiedPaymentEventInput | null {
  const provider = typeof input.provider === 'string' ? input.provider.trim().toLowerCase() : ''
  const providerEventId = typeof input.providerEventId === 'string' ? input.providerEventId.trim() : ''
  const providerPaymentId = optionalString(input.providerPaymentId)
  const providerSubscriptionId = optionalString(input.providerSubscriptionId)
  const eventType = typeof input.eventType === 'string' ? input.eventType.trim().toLowerCase() : ''
  const amountCents = Number(input.amountCents)
  const currency = normalizeCurrency(input.currency)
  const payloadHash = typeof input.payloadHash === 'string' ? input.payloadHash.trim().toLowerCase() : ''
  const verifiedAt = typeof input.verifiedAt === 'string' ? input.verifiedAt.trim() : ''
  const providerOccurredAt = optionalString(input.providerOccurredAt)
  const periodStart = optionalString(input.periodStart)
  const periodEnd = optionalString(input.periodEnd)

  if (!provider || provider.length > 80 || !providerEventId || providerEventId.length > 180) return null
  if (!['pending','confirmed','failed','cancelled','refunded'].includes(eventType)) return null
  if (!Number.isInteger(amountCents) || amountCents <= 0 || !currency) return null
  if (!/^[a-f0-9]{64}$/.test(payloadHash)) return null
  if (!verifiedAt || Number.isNaN(Date.parse(verifiedAt))) return null
  if (providerOccurredAt && !validIso(providerOccurredAt)) return null
  if ((periodStart && !validIso(periodStart)) || (periodEnd && !validIso(periodEnd))) return null
  if (periodEnd && !periodStart) return null
  if (periodStart && periodEnd && Date.parse(periodEnd) <= Date.parse(periodStart)) return null

  if (eventType === 'confirmed') {
    if (!providerPaymentId || !providerSubscriptionId) return null
    if (!validIso(periodStart) && !validIso(providerOccurredAt)) return null
  }

  return {
    provider, providerEventId, providerPaymentId, providerSubscriptionId,
    eventType: eventType as VerifiedPaymentEventType,
    amountCents, currency, payloadHash, verifiedAt, providerOccurredAt, periodStart, periodEnd,
  }
}

export interface PaymentProviderReadiness {
  provider: 'mercado_pago' | 'not_configured'
  credentialsPresent: boolean
  checkoutEnabled: boolean
  webhookVerificationEnabled: boolean
  canonicalResourceFetchEnabled: boolean
  reason: string
}

export function paymentProviderReadiness(env: Env): PaymentProviderReadiness {
  const provider = env.ACADEMY_PAYMENT_PROVIDER?.trim().toLowerCase()
  if (!provider) return {
    provider: 'not_configured', credentialsPresent: false, checkoutEnabled: false,
    webhookVerificationEnabled: false, canonicalResourceFetchEnabled: false,
    reason: 'Nenhum provider de pagamento foi homologado neste ambiente.',
  }
  if (provider !== 'mercado_pago') return {
    provider: 'not_configured', credentialsPresent: false, checkoutEnabled: false,
    webhookVerificationEnabled: false, canonicalResourceFetchEnabled: false,
    reason: 'Provider configurado não é suportado pela Academy.',
  }
  const access = Boolean(env.MERCADOPAGO_ACCESS_TOKEN?.trim())
  const webhook = Boolean(env.MERCADOPAGO_WEBHOOK_SECRET?.trim())
  const canonical = access && webhook
  const explicitCheckout = env.ACADEMY_PAYMENT_CHECKOUT_ENABLED?.trim().toLowerCase() === 'true'
  const returnUrl = Boolean(normalizePaymentReturnUrl(env.ACADEMY_PAYMENT_RETURN_URL))
  const checkoutEnabled = canonical && explicitCheckout && returnUrl
  return {
    provider: 'mercado_pago',
    credentialsPresent: canonical,
    checkoutEnabled,
    webhookVerificationEnabled: webhook,
    canonicalResourceFetchEnabled: canonical,
    reason: checkoutEnabled
      ? 'Mercado Pago está configurado para criar assinatura pendente; acesso só é ativado após webhook HMAC e verificação canônica.'
      : canonical && explicitCheckout && !returnUrl
        ? 'Criação de checkout foi habilitada, mas ACADEMY_PAYMENT_RETURN_URL não é válida.'
        : canonical && !explicitCheckout
          ? 'Webhook e consulta canônica estão prontos; criação externa permanece bloqueada pela feature flag ACADEMY_PAYMENT_CHECKOUT_ENABLED.'
          : webhook
            ? 'Webhook HMAC está habilitado, mas checkout/verificação canônica exigem MERCADOPAGO_ACCESS_TOKEN.'
            : 'Mercado Pago ainda não possui chave de Webhook configurada no ambiente.',
  }
}

export function canActivatePaidEntitlement(input: { paymentStatus: PaymentStatus; subscriptionStatus: string; activationReference?: string | null }): boolean {
  return input.paymentStatus === 'confirmed' && input.subscriptionStatus === 'active' && Boolean(input.activationReference?.trim())
}
