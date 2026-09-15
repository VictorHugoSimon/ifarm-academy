import { authenticatedJson } from './authenticatedFetch'

export interface PaymentProviderReadiness {
  provider: 'mercado_pago' | 'not_configured'
  credentialsPresent: boolean
  checkoutEnabled: boolean
  webhookVerificationEnabled: boolean
  canonicalResourceFetchEnabled: boolean
  reason: string
}

export interface CheckoutSession {
  id: string
  planId: string
  priceId: string
  subscriptionId: string
  billingInterval: 'monthly' | 'annual'
  priceUnit: 'subscription' | 'per_user'
  priceVersion: number
  amountCents: number
  currency: string
  status: 'created' | 'awaiting_provider' | 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'expired'
  provider?: string | null
  providerCheckoutId?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ProviderCheckoutSession {
  checkoutId: string
  provider: 'mercado_pago'
  status: 'requesting' | 'created' | 'failed'
  providerCheckoutId?: string | null
  checkoutUrl?: string | null
  providerStatus?: string | null
  attemptCount: number
  updatedAt: string
}

export async function listMyCheckoutSessions() {
  return authenticatedJson<{ data: CheckoutSession[]; provider: PaymentProviderReadiness }>('/api/checkout-sessions')
}

export async function createLocalCheckout(planId: string, billingInterval: 'monthly' | 'annual') {
  return authenticatedJson<{ data: CheckoutSession; idempotent: boolean; provider: PaymentProviderReadiness; note?: string }>(
    '/api/checkout-sessions',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId, billingInterval }),
    },
  )
}

export async function startProviderCheckout(checkoutId: string) {
  return authenticatedJson<{ data: ProviderCheckoutSession; idempotent: boolean; provider: PaymentProviderReadiness }>(
    '/api/checkout-provider',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutId }),
    },
  )
}

export function formatCheckoutAmount(amountCents: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amountCents / 100)
}
