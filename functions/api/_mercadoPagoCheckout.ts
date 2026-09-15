import { coreRequestTimeoutMs, extractBearerAuthorization, normalizeCoreApiUrl } from './_coreIdentity'
import { sha256Hex } from './_mercadoPagoWebhook'
import { normalizePaymentReturnUrl } from './_payments'
import type { Env } from './_shared'

const API_BASE = 'https://api.mercadopago.com'
const MAX_RESPONSE_CHARS = 256_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CheckoutInterval = 'monthly' | 'annual'
export type CheckoutFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface MercadoPagoCheckoutInput {
  checkoutId: string
  idempotencyKey: string
  planName: string
  billingInterval: CheckoutInterval
  amountCents: number
  currency: string
  payerEmail: string
}

export interface MercadoPagoCheckoutSuccess {
  ok: true
  provider: 'mercado_pago'
  resourceId: string
  checkoutUrl: string
  providerStatus: string
  externalReference: string
  responseHash: string
}

export interface MercadoPagoCheckoutFailure {
  ok: false
  code:
    | 'checkout_disabled'
    | 'provider_not_configured'
    | 'return_url_not_configured'
    | 'invalid_checkout_input'
    | 'unsupported_currency'
    | 'provider_timeout'
    | 'provider_unavailable'
    | 'provider_auth_failed'
    | 'provider_rejected'
    | 'provider_invalid_response'
    | 'provider_resource_mismatch'
  retryable: boolean
  httpStatus?: number
}

export type MercadoPagoCheckoutResult = MercadoPagoCheckoutSuccess | MercadoPagoCheckoutFailure

function text(value: unknown, max = 240): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value).trim()
  return normalized && normalized.length <= max ? normalized : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function cents(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const result = Math.round((amount + Number.EPSILON) * 100)
  return Number.isSafeInteger(result) && result > 0 ? result : null
}

function isAllowedCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && (host === 'mercadopago.com.br' || host.endsWith('.mercadopago.com.br'))
  } catch {
    return false
  }
}

function recurrence(interval: CheckoutInterval) {
  return interval === 'monthly'
    ? { frequency: 1, frequency_type: 'months' as const }
    : { frequency: 12, frequency_type: 'months' as const }
}

export function mercadoPagoCheckoutEnabled(env: Env): boolean {
  return env.ACADEMY_PAYMENT_PROVIDER?.trim().toLowerCase() === 'mercado_pago'
    && env.ACADEMY_PAYMENT_CHECKOUT_ENABLED?.trim().toLowerCase() === 'true'
    && Boolean(env.MERCADOPAGO_ACCESS_TOKEN?.trim())
    && Boolean(env.MERCADOPAGO_WEBHOOK_SECRET?.trim())
    && Boolean(normalizePaymentReturnUrl(env.ACADEMY_PAYMENT_RETURN_URL))
}

export async function resolveCorePayerEmail(
  env: Env,
  request: Request,
  fetcher: CheckoutFetch = fetch,
): Promise<{ ok: true; email: string } | { ok: false; code: 'core_not_configured' | 'auth_required' | 'core_unavailable' | 'payer_email_unavailable'; retryable: boolean }> {
  const baseUrl = env.ACADEMY_CORE_API_URL ? normalizeCoreApiUrl(env.ACADEMY_CORE_API_URL) : null
  if (!baseUrl) return { ok: false, code: 'core_not_configured', retryable: false }
  const authorization = extractBearerAuthorization(request)
  if (!authorization) return { ok: false, code: 'auth_required', retryable: false }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), coreRequestTimeoutMs(env))
  let response: Response
  try {
    response = await fetcher(`${baseUrl}/api/v1/me`, {
      method: 'GET',
      headers: { authorization, accept: 'application/json' },
      signal: controller.signal,
    })
  } catch {
    clearTimeout(timer)
    return { ok: false, code: 'core_unavailable', retryable: true }
  }
  clearTimeout(timer)
  if (!response.ok) return { ok: false, code: response.status >= 500 ? 'core_unavailable' : 'payer_email_unavailable', retryable: response.status >= 500 }

  let payload: Record<string, unknown>
  try { payload = asRecord(await response.json()) }
  catch { return { ok: false, code: 'core_unavailable', retryable: true } }
  const email = text(payload.email, 254)?.toLowerCase() ?? ''
  if (!email || !EMAIL_RE.test(email)) return { ok: false, code: 'payer_email_unavailable', retryable: false }
  return { ok: true, email }
}

export async function createMercadoPagoPendingSubscription(
  env: Env,
  input: MercadoPagoCheckoutInput,
  fetcher: CheckoutFetch = fetch,
): Promise<MercadoPagoCheckoutResult> {
  if (env.ACADEMY_PAYMENT_CHECKOUT_ENABLED?.trim().toLowerCase() !== 'true') {
    return { ok: false, code: 'checkout_disabled', retryable: false }
  }
  if (env.ACADEMY_PAYMENT_PROVIDER?.trim().toLowerCase() !== 'mercado_pago' || !env.MERCADOPAGO_ACCESS_TOKEN?.trim()) {
    return { ok: false, code: 'provider_not_configured', retryable: false }
  }
  const backUrl = normalizePaymentReturnUrl(env.ACADEMY_PAYMENT_RETURN_URL)
  if (!backUrl) return { ok: false, code: 'return_url_not_configured', retryable: false }

  const planName = input.planName.trim().slice(0, 120)
  const payerEmail = input.payerEmail.trim().toLowerCase()
  const currency = input.currency.trim().toUpperCase()
  if (!UUID_RE.test(input.checkoutId) || !UUID_RE.test(input.idempotencyKey) || !planName
    || !['monthly', 'annual'].includes(input.billingInterval)
    || !Number.isSafeInteger(input.amountCents) || input.amountCents <= 0
    || !EMAIL_RE.test(payerEmail)) {
    return { ok: false, code: 'invalid_checkout_input', retryable: false }
  }
  if (currency !== 'BRL') return { ok: false, code: 'unsupported_currency', retryable: false }

  const recurring = recurrence(input.billingInterval)
  const body = {
    reason: planName,
    external_reference: input.checkoutId,
    payer_email: payerEmail,
    auto_recurring: {
      ...recurring,
      transaction_amount: Number((input.amountCents / 100).toFixed(2)),
      currency_id: currency,
    },
    back_url: backUrl,
    status: 'pending',
  }

  const controller = new AbortController()
  const timeoutMs = Math.min(10_000, Math.max(750, Math.trunc(Number(env.MERCADOPAGO_REQUEST_TIMEOUT_MS ?? 5000) || 5000)))
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetcher(`${API_BASE}/preapproval`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN!.trim()}`,
        accept: 'application/json',
        'content-type': 'application/json',
        'x-idempotency-key': input.idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timer)
    return {
      ok: false,
      code: error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_unavailable',
      retryable: true,
    }
  }
  clearTimeout(timer)

  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: 'provider_auth_failed', retryable: false, httpStatus: response.status }
  }
  if (!response.ok) {
    return {
      ok: false,
      code: response.status >= 500 || response.status === 429 ? 'provider_unavailable' : 'provider_rejected',
      retryable: response.status >= 500 || response.status === 429,
      httpStatus: response.status,
    }
  }

  const raw = await response.text()
  if (!raw || raw.length > MAX_RESPONSE_CHARS) return { ok: false, code: 'provider_invalid_response', retryable: false }
  let payload: Record<string, unknown>
  try { payload = asRecord(JSON.parse(raw)) }
  catch { return { ok: false, code: 'provider_invalid_response', retryable: false } }

  const resourceId = text(payload.id, 200)
  const checkoutUrl = text(payload.init_point, 2048)
  const providerStatus = text(payload.status, 80)?.toLowerCase() ?? ''
  const externalReference = text(payload.external_reference, 200)
  const autoRecurring = asRecord(payload.auto_recurring)
  const responseAmount = cents(autoRecurring.transaction_amount)
  const responseCurrency = text(autoRecurring.currency_id, 3)?.toUpperCase() ?? null

  if (!resourceId || !checkoutUrl || !isAllowedCheckoutUrl(checkoutUrl) || !providerStatus || !externalReference) {
    return { ok: false, code: 'provider_invalid_response', retryable: false }
  }
  if (externalReference !== input.checkoutId || responseAmount !== input.amountCents || responseCurrency !== currency) {
    return { ok: false, code: 'provider_resource_mismatch', retryable: false }
  }

  return {
    ok: true,
    provider: 'mercado_pago',
    resourceId,
    checkoutUrl,
    providerStatus,
    externalReference,
    responseHash: await sha256Hex(raw),
  }
}
