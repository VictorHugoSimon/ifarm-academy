import type { Env } from './_shared'

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'refunded'
export type VerifiedPaymentEventType = PaymentStatus

export interface VerifiedPaymentEventInput {
  provider: string
  providerEventId: string
  providerPaymentId?: string | null
  eventType: VerifiedPaymentEventType
  amountCents: number
  currency: string
  payloadHash: string
  verifiedAt: string
}

const TRANSITIONS: Record<PaymentStatus, ReadonlySet<PaymentStatus>> = {
  pending: new Set(['pending','confirmed','failed','cancelled']),
  failed: new Set(['failed','pending','confirmed','cancelled']),
  confirmed: new Set(['confirmed','refunded']),
  cancelled: new Set(['cancelled']),
  refunded: new Set(['refunded']),
}

export function nextPaymentStatus(current: PaymentStatus, eventType: VerifiedPaymentEventType): PaymentStatus {
  if (!TRANSITIONS[current].has(eventType)) {
    throw new Error(`invalid payment transition: ${current} -> ${eventType}`)
  }
  return eventType
}

export function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const currency = value.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(currency) ? currency : null
}

export function normalizeVerifiedPaymentEvent(input: Record<string, unknown>): VerifiedPaymentEventInput | null {
  const provider = typeof input.provider === 'string' ? input.provider.trim().toLowerCase() : ''
  const providerEventId = typeof input.providerEventId === 'string' ? input.providerEventId.trim() : ''
  const providerPaymentId = typeof input.providerPaymentId === 'string' ? input.providerPaymentId.trim() || null : null
  const eventType = typeof input.eventType === 'string' ? input.eventType.trim().toLowerCase() : ''
  const amountCents = Number(input.amountCents)
  const currency = normalizeCurrency(input.currency)
  const payloadHash = typeof input.payloadHash === 'string' ? input.payloadHash.trim().toLowerCase() : ''
  const verifiedAt = typeof input.verifiedAt === 'string' ? input.verifiedAt.trim() : ''

  if (!provider || provider.length > 80 || !providerEventId || providerEventId.length > 180) return null
  if (!['pending','confirmed','failed','cancelled','refunded'].includes(eventType)) return null
  if (!Number.isInteger(amountCents) || amountCents <= 0 || !currency) return null
  if (!/^[a-f0-9]{64}$/.test(payloadHash)) return null
  if (!verifiedAt || Number.isNaN(Date.parse(verifiedAt))) return null

  return {
    provider,
    providerEventId,
    providerPaymentId,
    eventType: eventType as VerifiedPaymentEventType,
    amountCents,
    currency,
    payloadHash,
    verifiedAt,
  }
}

export interface PaymentProviderReadiness {
  provider: 'mercado_pago' | 'not_configured'
  credentialsPresent: boolean
  checkoutEnabled: boolean
  webhookVerificationEnabled: boolean
  reason: string
}

export function paymentProviderReadiness(env: Env): PaymentProviderReadiness {
  const provider = env.ACADEMY_PAYMENT_PROVIDER?.trim().toLowerCase()
  if (!provider) {
    return {
      provider: 'not_configured', credentialsPresent: false, checkoutEnabled: false, webhookVerificationEnabled: false,
      reason: 'Nenhum provider de pagamento foi homologado neste ambiente.',
    }
  }
  if (provider !== 'mercado_pago') {
    return {
      provider: 'not_configured', credentialsPresent: false, checkoutEnabled: false, webhookVerificationEnabled: false,
      reason: 'Provider configurado não é suportado pela Academy.',
    }
  }
  const access = Boolean(env.MERCADOPAGO_ACCESS_TOKEN?.trim())
  const webhook = Boolean(env.MERCADOPAGO_WEBHOOK_SECRET?.trim())
  return {
    provider: 'mercado_pago',
    credentialsPresent: access && webhook,
    checkoutEnabled: false,
    webhookVerificationEnabled: false,
    reason: access && webhook
      ? 'Credenciais detectadas, mas o adapter Mercado Pago ainda não foi homologado nesta release.'
      : 'Mercado Pago ainda não possui credenciais completas no ambiente.',
  }
}

export function canActivatePaidEntitlement(input: {
  paymentStatus: PaymentStatus
  subscriptionStatus: string
  activationReference?: string | null
}): boolean {
  return input.paymentStatus === 'confirmed'
    && input.subscriptionStatus === 'active'
    && Boolean(input.activationReference?.trim())
}
