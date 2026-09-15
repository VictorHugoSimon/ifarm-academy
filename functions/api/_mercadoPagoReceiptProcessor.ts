import { sha256Hex } from './_mercadoPagoWebhook'
import {
  fetchMercadoPagoCanonicalResource,
  type MercadoPagoCanonicalResource,
  type MercadoPagoFetch,
} from './_mercadoPagoProvider'
import { processVerifiedPaymentEvent } from './_paymentProcessor'
import type { Env } from './_shared'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface MercadoPagoReceiptProcessingResult {
  status: 'verified_pending_resource_fetch' | 'canonical_verified' | 'processed' | 'ignored' | 'failed'
  retryable: boolean
  detailCode: string
  paymentStatus?: string
  accessAction?: string
  idempotent?: boolean
}

function addBillingInterval(start: string, interval: string): string | null {
  const date = new Date(start)
  if (Number.isNaN(date.getTime())) return null
  const originalDay = date.getUTCDate()
  if (interval === 'monthly') {
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() + 1)
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
    date.setUTCDate(Math.min(originalDay, lastDay))
    return date.toISOString()
  }
  if (interval === 'annual') {
    const month = date.getUTCMonth()
    date.setUTCDate(1)
    date.setUTCFullYear(date.getUTCFullYear() + 1)
    date.setUTCMonth(month)
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
    date.setUTCDate(Math.min(originalDay, lastDay))
    return date.toISOString()
  }
  return null
}

function resourceFromReceipt(row: any): MercadoPagoCanonicalResource | null {
  if (!row?.canonical_resource_hash || !row?.canonical_resource_type || !row?.canonical_resource_id) return null
  return {
    notificationType: row.notification_type,
    resourceType: row.canonical_resource_type,
    resourceId: row.canonical_resource_id,
    canonicalStatus: row.canonical_status ?? null,
    externalReference: row.canonical_external_reference ?? null,
    amountCents: row.canonical_amount_cents == null ? null : Number(row.canonical_amount_cents),
    currency: row.canonical_currency ?? null,
    providerPaymentId: row.provider_payment_id ?? null,
    providerSubscriptionId: row.provider_subscription_id ?? null,
    occurredAt: row.canonical_occurred_at ?? null,
    periodStart: row.canonical_period_start ?? null,
    periodEnd: row.canonical_period_end ?? null,
    eventType: eventTypeFromStatus(row.canonical_status ?? null),
    payloadHash: row.canonical_resource_hash,
  }
}

function eventTypeFromStatus(status: string | null): 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'refunded' | null {
  if (['pending','in_process','authorized','scheduled'].includes(status ?? '')) return 'pending'
  if (status === 'approved') return 'confirmed'
  if (['rejected','failed'].includes(status ?? '')) return 'failed'
  if (['cancelled','canceled'].includes(status ?? '')) return 'cancelled'
  if (['refunded','charged_back'].includes(status ?? '')) return 'refunded'
  return null
}

async function markReceiptFailure(db: any, receiptId: string, detailCode: string) {
  await db.prepare(`UPDATE academy_payment_webhook_receipts
    SET status='failed',detail_code=?,last_error_code=? WHERE id=?`).bind(detailCode, detailCode, receiptId).run()
}

async function recordFetchFailure(db: any, receiptId: string, code: string) {
  const now = new Date().toISOString()
  await db.prepare(`UPDATE academy_payment_webhook_receipts
    SET fetch_attempts=fetch_attempts+1,last_fetch_at=?,last_error_code=?,detail_code=? WHERE id=?`)
    .bind(now, code, code, receiptId).run()
}

export async function processMercadoPagoReceipt(
  env: Env,
  db: any,
  receiptInput: any,
  fetcher: MercadoPagoFetch = fetch,
): Promise<MercadoPagoReceiptProcessingResult> {
  let receipt = receiptInput
  if (!receipt?.id) return { status: 'failed', retryable: false, detailCode: 'receipt_not_found' }
  if (receipt.status === 'ignored') return { status: 'ignored', retryable: false, detailCode: String(receipt.detail_code ?? 'ignored') }
  if (receipt.status === 'processed') return { status: 'processed', retryable: false, detailCode: String(receipt.detail_code ?? 'processed'), idempotent: true }
  if (receipt.status === 'failed') return { status: 'failed', retryable: false, detailCode: String(receipt.detail_code ?? 'failed') }

  let canonical = resourceFromReceipt(receipt)
  if (!canonical) {
    const fetched = await fetchMercadoPagoCanonicalResource(env, String(receipt.notification_type), String(receipt.data_id), fetcher)
    if (!fetched.ok) {
      await recordFetchFailure(db, String(receipt.id), fetched.code)
      if (!fetched.retryable) {
        await markReceiptFailure(db, String(receipt.id), fetched.code)
        return { status: 'failed', retryable: false, detailCode: fetched.code }
      }
      return { status: 'verified_pending_resource_fetch', retryable: true, detailCode: fetched.code }
    }
    canonical = fetched.resource
    const fetchedAt = new Date().toISOString()
    await db.prepare(`UPDATE academy_payment_webhook_receipts SET
      status='canonical_verified',detail_code='canonical_resource_verified',canonical_resource_type=?,canonical_resource_id=?,
      canonical_status=?,canonical_external_reference=?,canonical_amount_cents=?,canonical_currency=?,canonical_resource_hash=?,
      canonical_fetched_at=?,canonical_occurred_at=?,canonical_period_start=?,canonical_period_end=?,provider_payment_id=?,
      provider_subscription_id=?,fetch_attempts=fetch_attempts+1,last_fetch_at=?,last_error_code=NULL
      WHERE id=?`).bind(
      canonical.resourceType, canonical.resourceId, canonical.canonicalStatus, canonical.externalReference,
      canonical.amountCents, canonical.currency, canonical.payloadHash, fetchedAt, canonical.occurredAt,
      canonical.periodStart, canonical.periodEnd, canonical.providerPaymentId, canonical.providerSubscriptionId,
      fetchedAt, receipt.id,
    ).run()
    receipt = await db.prepare('SELECT * FROM academy_payment_webhook_receipts WHERE id=? LIMIT 1').bind(receipt.id).first()
  }

  if (canonical.resourceType === 'preapproval_plan') {
    return { status: 'canonical_verified', retryable: false, detailCode: 'no_checkout_correlation_required' }
  }

  const checkoutId = canonical.externalReference?.trim() ?? ''
  if (!UUID_RE.test(checkoutId)) {
    await markReceiptFailure(db, String(receipt.id), 'canonical_checkout_reference_missing_or_invalid')
    return { status: 'failed', retryable: false, detailCode: 'canonical_checkout_reference_missing_or_invalid' }
  }

  const checkout = await db.prepare('SELECT * FROM academy_checkout_sessions WHERE id=? LIMIT 1').bind(checkoutId).first()
  if (!checkout) {
    await markReceiptFailure(db, String(receipt.id), 'canonical_checkout_not_found')
    return { status: 'failed', retryable: false, detailCode: 'canonical_checkout_not_found' }
  }
  if (canonical.amountCents != null && Number(checkout.amount_cents) !== canonical.amountCents) {
    await markReceiptFailure(db, String(receipt.id), 'canonical_amount_mismatch')
    return { status: 'failed', retryable: false, detailCode: 'canonical_amount_mismatch' }
  }
  if (canonical.currency && String(checkout.currency) !== canonical.currency) {
    await markReceiptFailure(db, String(receipt.id), 'canonical_currency_mismatch')
    return { status: 'failed', retryable: false, detailCode: 'canonical_currency_mismatch' }
  }

  let providerSubscriptionId = canonical.providerSubscriptionId
  if (canonical.resourceType === 'preapproval') {
    if (checkout.provider_checkout_id && String(checkout.provider_checkout_id) !== canonical.resourceId) {
      await markReceiptFailure(db, String(receipt.id), 'canonical_subscription_mismatch')
      return { status: 'failed', retryable: false, detailCode: 'canonical_subscription_mismatch' }
    }
    await db.prepare(`UPDATE academy_checkout_sessions SET provider='mercado_pago',provider_checkout_id=COALESCE(provider_checkout_id,?),
      status=CASE WHEN status='created' THEN 'awaiting_provider' ELSE status END,updated_at=? WHERE id=?`)
      .bind(canonical.resourceId, new Date().toISOString(), checkout.id).run()
    await db.prepare(`UPDATE academy_payment_webhook_receipts SET tenant_id=?,checkout_session_id=?,detail_code='canonical_preapproval_verified'
      WHERE id=?`).bind(checkout.tenant_id, checkout.id, receipt.id).run()
    return { status: 'canonical_verified', retryable: false, detailCode: 'canonical_preapproval_verified' }
  }

  if (canonical.resourceType === 'authorized_payment' && providerSubscriptionId) {
    if (checkout.provider_checkout_id && String(checkout.provider_checkout_id) !== providerSubscriptionId) {
      await markReceiptFailure(db, String(receipt.id), 'canonical_subscription_mismatch')
      return { status: 'failed', retryable: false, detailCode: 'canonical_subscription_mismatch' }
    }
    await db.prepare(`UPDATE academy_checkout_sessions SET provider='mercado_pago',provider_checkout_id=COALESCE(provider_checkout_id,?),updated_at=? WHERE id=?`)
      .bind(providerSubscriptionId, new Date().toISOString(), checkout.id).run()
  }
  if (!providerSubscriptionId && String(checkout.provider ?? '') === 'mercado_pago' && checkout.provider_checkout_id) {
    providerSubscriptionId = String(checkout.provider_checkout_id)
  }

  await db.prepare(`UPDATE academy_payment_webhook_receipts SET tenant_id=?,checkout_session_id=?,provider_subscription_id=COALESCE(provider_subscription_id,?),
    detail_code='canonical_payment_correlated' WHERE id=?`).bind(checkout.tenant_id, checkout.id, providerSubscriptionId, receipt.id).run()

  const eventType = canonical.eventType ?? eventTypeFromStatus(canonical.canonicalStatus)
  if (!eventType || canonical.amountCents == null || !canonical.currency) {
    return { status: 'canonical_verified', retryable: false, detailCode: 'no_payment_state_transition' }
  }

  let periodStart = canonical.periodStart
  let periodEnd = canonical.periodEnd
  if (eventType === 'confirmed') {
    periodStart = periodStart ?? canonical.occurredAt
    periodEnd = periodEnd ?? (periodStart ? addBillingInterval(periodStart, String(checkout.billing_interval)) : null)
    if (!canonical.providerPaymentId || !providerSubscriptionId || !periodStart || !periodEnd) {
      await db.prepare(`UPDATE academy_payment_webhook_receipts SET detail_code='confirmed_waiting_subscription_evidence' WHERE id=?`)
        .bind(receipt.id).run()
      return { status: 'canonical_verified', retryable: true, detailCode: 'confirmed_waiting_subscription_evidence' }
    }
  }

  const eventFingerprint = await sha256Hex([
    canonical.notificationType, canonical.resourceId, canonical.canonicalStatus ?? '', canonical.occurredAt ?? '', canonical.payloadHash,
  ].join('|'))
  try {
    const result = await processVerifiedPaymentEvent(db, {
      tenantId: String(checkout.tenant_id),
      checkoutSessionId: String(checkout.id),
      event: {
        provider: 'mercado_pago',
        providerEventId: `mp:${eventFingerprint.slice(0, 64)}`,
        providerPaymentId: canonical.providerPaymentId,
        providerSubscriptionId,
        eventType,
        amountCents: canonical.amountCents,
        currency: canonical.currency,
        payloadHash: canonical.payloadHash,
        verifiedAt: new Date().toISOString(),
        periodStart,
        periodEnd,
      },
    })
    await db.prepare(`UPDATE academy_payment_webhook_receipts SET status='processed',detail_code=?,last_error_code=NULL WHERE id=?`)
      .bind(`payment_${result.paymentStatus}`, receipt.id).run()
    return {
      status: 'processed', retryable: false, detailCode: `payment_${result.paymentStatus}`,
      paymentStatus: result.paymentStatus, accessAction: result.accessAction, idempotent: result.idempotent,
    }
  } catch {
    await markReceiptFailure(db, String(receipt.id), 'verified_payment_processor_rejected')
    return { status: 'failed', retryable: false, detailCode: 'verified_payment_processor_rejected' }
  }
}
