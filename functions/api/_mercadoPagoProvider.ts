import { sha256Hex } from './_mercadoPagoWebhook'
import type { Env } from './_shared'
import type { VerifiedPaymentEventType } from './_payments'

export type MercadoPagoCanonicalType =
  | 'payment'
  | 'subscription_preapproval'
  | 'subscription_preapproval_plan'
  | 'subscription_authorized_payment'

export interface MercadoPagoCanonicalResource {
  notificationType: MercadoPagoCanonicalType
  resourceType: 'payment' | 'preapproval' | 'preapproval_plan' | 'authorized_payment'
  resourceId: string
  canonicalStatus: string | null
  externalReference: string | null
  amountCents: number | null
  currency: string | null
  providerPaymentId: string | null
  providerSubscriptionId: string | null
  occurredAt: string | null
  periodStart: string | null
  periodEnd: string | null
  eventType: VerifiedPaymentEventType | null
  payloadHash: string
}

export interface MercadoPagoProviderFailure {
  ok: false
  code:
    | 'provider_not_configured'
    | 'invalid_resource_id'
    | 'provider_timeout'
    | 'provider_unavailable'
    | 'provider_auth_failed'
    | 'provider_resource_not_found'
    | 'provider_invalid_response'
    | 'provider_resource_mismatch'
  retryable: boolean
  httpStatus?: number
}

export interface MercadoPagoProviderSuccess {
  ok: true
  resource: MercadoPagoCanonicalResource
}

export type MercadoPagoProviderResult = MercadoPagoProviderSuccess | MercadoPagoProviderFailure
export type MercadoPagoFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const API_BASE = 'https://api.mercadopago.com'
const MAX_RESPONSE_CHARS = 256_000
const SIMPLE_ID = /^[A-Za-z0-9._:-]{1,200}$/

export function mercadoPagoRequestTimeoutMs(env: Env): number {
  const configured = Number(env.MERCADOPAGO_REQUEST_TIMEOUT_MS ?? 5000)
  if (!Number.isFinite(configured)) return 5000
  return Math.min(10_000, Math.max(750, Math.trunc(configured)))
}

export function mercadoPagoCanonicalPath(type: string, resourceId: string): string | null {
  if (!SIMPLE_ID.test(resourceId)) return null
  if (type === 'payment') return `/v1/payments/${encodeURIComponent(resourceId)}`
  if (type === 'subscription_preapproval') return `/preapproval/${encodeURIComponent(resourceId)}`
  if (type === 'subscription_preapproval_plan') return `/preapproval_plan/${encodeURIComponent(resourceId)}`
  if (type === 'subscription_authorized_payment') return `/authorized_payments/${encodeURIComponent(resourceId)}`
  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown, max = 200): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const result = String(value).trim()
  return result && result.length <= max ? result : null
}

function iso(value: unknown): string | null {
  const result = text(value, 80)
  return result && !Number.isNaN(Date.parse(result)) ? result : null
}

function cents(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const result = Math.round((amount + Number.EPSILON) * 100)
  return Number.isSafeInteger(result) && result > 0 ? result : null
}

function currency(value: unknown): string | null {
  const result = text(value, 3)?.toUpperCase() ?? null
  return result && /^[A-Z]{3}$/.test(result) ? result : null
}

export function mapMercadoPagoPaymentStatus(value: unknown): VerifiedPaymentEventType | null {
  const status = text(value, 60)?.toLowerCase() ?? ''
  if (['pending', 'in_process', 'authorized', 'scheduled'].includes(status)) return 'pending'
  if (status === 'approved') return 'confirmed'
  if (['rejected', 'failed'].includes(status)) return 'failed'
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled'
  if (['refunded', 'charged_back'].includes(status)) return 'refunded'
  return null
}

function normalizedResource(
  type: MercadoPagoCanonicalType,
  payload: Record<string, unknown>,
  payloadHash: string,
): Omit<MercadoPagoCanonicalResource, 'payloadHash'> | null {
  const id = text(payload.id)
  if (!id) return null

  if (type === 'payment') {
    const status = text(payload.status, 80)?.toLowerCase() ?? null
    return {
      notificationType: type,
      resourceType: 'payment',
      resourceId: id,
      canonicalStatus: status,
      externalReference: text(payload.external_reference),
      amountCents: cents(payload.transaction_amount),
      currency: currency(payload.currency_id),
      providerPaymentId: id,
      providerSubscriptionId: null,
      occurredAt: iso(payload.date_last_updated) ?? iso(payload.date_approved) ?? iso(payload.date_created),
      periodStart: null,
      periodEnd: null,
      eventType: mapMercadoPagoPaymentStatus(status),
    }
  }

  if (type === 'subscription_authorized_payment') {
    const payment = asRecord(payload.payment)
    const canonicalStatus = text(payment.status, 80)?.toLowerCase()
      ?? text(payload.summarized, 80)?.toLowerCase()
      ?? text(payload.status, 80)?.toLowerCase()
      ?? null
    return {
      notificationType: type,
      resourceType: 'authorized_payment',
      resourceId: id,
      canonicalStatus,
      externalReference: text(payload.external_reference),
      amountCents: cents(payload.transaction_amount),
      currency: currency(payload.currency_id),
      providerPaymentId: text(payment.id),
      providerSubscriptionId: text(payload.preapproval_id),
      occurredAt: iso(payload.last_modified) ?? iso(payload.debit_date) ?? iso(payload.date_created),
      periodStart: iso(payload.debit_date) ?? iso(payload.date_created),
      periodEnd: null,
      eventType: mapMercadoPagoPaymentStatus(canonicalStatus),
    }
  }

  if (type === 'subscription_preapproval') {
    const recurring = asRecord(payload.auto_recurring)
    return {
      notificationType: type,
      resourceType: 'preapproval',
      resourceId: id,
      canonicalStatus: text(payload.status, 80)?.toLowerCase() ?? null,
      externalReference: text(payload.external_reference),
      amountCents: cents(recurring.transaction_amount),
      currency: currency(recurring.currency_id),
      providerPaymentId: null,
      providerSubscriptionId: id,
      occurredAt: iso(payload.last_modified) ?? iso(payload.date_created),
      periodStart: iso(recurring.start_date),
      periodEnd: iso(recurring.end_date),
      eventType: null,
    }
  }

  return {
    notificationType: type,
    resourceType: 'preapproval_plan',
    resourceId: id,
    canonicalStatus: text(payload.status, 80)?.toLowerCase() ?? null,
    externalReference: text(payload.external_reference),
    amountCents: null,
    currency: null,
    providerPaymentId: null,
    providerSubscriptionId: null,
    occurredAt: iso(payload.last_modified) ?? iso(payload.date_created),
    periodStart: null,
    periodEnd: null,
    eventType: null,
  }
}

export async function fetchMercadoPagoCanonicalResource(
  env: Env,
  notificationType: string,
  resourceId: string,
  fetcher: MercadoPagoFetch = fetch,
): Promise<MercadoPagoProviderResult> {
  const accessToken = env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? ''
  if (!accessToken) return { ok: false, code: 'provider_not_configured', retryable: true }

  const path = mercadoPagoCanonicalPath(notificationType, resourceId)
  if (!path) return { ok: false, code: 'invalid_resource_id', retryable: false }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), mercadoPagoRequestTimeoutMs(env))
  let response: Response
  try {
    response = await fetcher(`${API_BASE}${path}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timeout)
    return {
      ok: false,
      code: error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_unavailable',
      retryable: true,
    }
  }
  clearTimeout(timeout)

  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: 'provider_auth_failed', retryable: true, httpStatus: response.status }
  }
  if (response.status === 404) {
    return { ok: false, code: 'provider_resource_not_found', retryable: true, httpStatus: 404 }
  }
  if (!response.ok) {
    return { ok: false, code: 'provider_unavailable', retryable: response.status >= 500, httpStatus: response.status }
  }

  const raw = await response.text()
  if (!raw || raw.length > MAX_RESPONSE_CHARS) {
    return { ok: false, code: 'provider_invalid_response', retryable: false, httpStatus: response.status }
  }
  let payload: Record<string, unknown>
  try { payload = asRecord(JSON.parse(raw)) }
  catch { return { ok: false, code: 'provider_invalid_response', retryable: false, httpStatus: response.status } }

  const payloadHash = await sha256Hex(raw)
  const normalized = normalizedResource(notificationType as MercadoPagoCanonicalType, payload, payloadHash)
  if (!normalized) return { ok: false, code: 'provider_invalid_response', retryable: false, httpStatus: response.status }
  if (normalized.resourceId.toLowerCase() !== resourceId.toLowerCase()) {
    return { ok: false, code: 'provider_resource_mismatch', retryable: false, httpStatus: response.status }
  }
  return { ok: true, resource: { ...normalized, payloadHash } }
}
