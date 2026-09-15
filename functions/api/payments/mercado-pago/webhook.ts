import {
  classifyMercadoPagoNotificationType,
  normalizeMercadoPagoDataId,
  sha256Hex,
  verifyMercadoPagoWebhookSignature,
} from '../../_mercadoPagoWebhook'
import {
  fetchMercadoPagoCanonicalResource,
  type MercadoPagoCanonicalResource,
} from '../../_mercadoPagoProvider'
import { processVerifiedPaymentEvent } from '../../_paymentProcessor'
import { dbOr503, json, type Env } from '../../_shared'

const MAX_BODY_CHARS = 128_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function safeText(value: unknown, max: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  return text && text.length <= max ? text : null
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
    eventType: null,
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

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ?? ''
  if (!secret) return json({ error: 'MERCADOPAGO_WEBHOOK_NOT_CONFIGURED' }, 503)

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_CHARS) {
    return json({ error: 'WEBHOOK_BODY_TOO_LARGE' }, 413)
  }

  const url = new URL(request.url)
  const queryDataId = url.searchParams.get('data.id')
  const verification = await verifyMercadoPagoWebhookSignature({
    xSignature: request.headers.get('x-signature'),
    xRequestId: request.headers.get('x-request-id'),
    dataId: queryDataId,
    secret,
  })
  if (!verification.valid) return json({ error: 'INVALID_WEBHOOK_SIGNATURE' }, 401)

  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY_CHARS) return json({ error: 'WEBHOOK_BODY_TOO_LARGE' }, 413)

  let payload: Record<string, unknown>
  try { payload = JSON.parse(rawBody) as Record<string, unknown> }
  catch { return json({ error: 'INVALID_WEBHOOK_JSON' }, 400) }

  const data = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : {}
  const bodyDataId = normalizeMercadoPagoDataId(safeText(data.id, 200))
  const normalizedQueryId = normalizeMercadoPagoDataId(queryDataId)
  if (!bodyDataId || !normalizedQueryId || bodyDataId !== normalizedQueryId) {
    return json({ error: 'WEBHOOK_DATA_ID_MISMATCH' }, 400)
  }

  const queryType = safeText(url.searchParams.get('type'), 100)?.toLowerCase() ?? null
  const bodyType = safeText(payload.type, 100)?.toLowerCase() ?? ''
  if (!bodyType) return json({ error: 'WEBHOOK_TYPE_REQUIRED' }, 400)
  if (queryType && queryType !== bodyType) return json({ error: 'WEBHOOK_TYPE_MISMATCH' }, 400)

  const requestId = request.headers.get('x-request-id')!.trim()
  const db = dbOr503(env); if (db instanceof Response) return db
  let receipt = await db.prepare(`SELECT * FROM academy_payment_webhook_receipts
    WHERE provider='mercado_pago' AND request_id=? LIMIT 1`).bind(requestId).first()

  const classification = classifyMercadoPagoNotificationType(bodyType)
  if (!receipt) {
    const status = classification === 'supported' ? 'verified_pending_resource_fetch' : 'ignored'
    const now = new Date().toISOString()
    const receiptId = crypto.randomUUID()
    const bodyHash = await sha256Hex(rawBody)
    const notificationId = safeText(payload.id, 180)
    const action = safeText(payload.action, 160)
    const detailCode = classification === 'supported' ? 'awaiting_canonical_resource_fetch' : 'unsupported_notification_type'
    try {
      await db.prepare(`INSERT INTO academy_payment_webhook_receipts
        (id,provider,request_id,notification_id,data_id,notification_type,action,signature_ts,body_hash,
         verified_at,received_at,status,detail_code)
        VALUES (?,'mercado_pago',?,?,?,?,?,?,?,?,?,?,?)`).bind(
        receiptId, requestId, notificationId, normalizedQueryId, bodyType, action,
        verification.ts, bodyHash, now, now, status, detailCode,
      ).run()
    } catch {
      receipt = await db.prepare(`SELECT * FROM academy_payment_webhook_receipts
        WHERE provider='mercado_pago' AND request_id=? LIMIT 1`).bind(requestId).first()
      if (!receipt) return json({ error: 'WEBHOOK_RECEIPT_PERSISTENCE_FAILED' }, 503)
    }
    if (!receipt) receipt = await db.prepare('SELECT * FROM academy_payment_webhook_receipts WHERE id=? LIMIT 1').bind(receiptId).first()
  }

  if (!receipt) return json({ error: 'WEBHOOK_RECEIPT_NOT_FOUND' }, 503)
  if (receipt.status === 'ignored' || receipt.status === 'processed' || receipt.status === 'failed') {
    return json({ accepted: true, idempotent: true, status: receipt.status, receiptId: receipt.id })
  }
  if (classification !== 'supported') return json({ accepted: true, idempotent: true, status: 'ignored', receiptId: receipt.id })

  let canonical = resourceFromReceipt(receipt)
  if (!canonical) {
    const fetched = await fetchMercadoPagoCanonicalResource(env, bodyType, normalizedQueryId)
    if (!fetched.ok) {
      await recordFetchFailure(db, String(receipt.id), fetched.code)
      if (!fetched.retryable) {
        await markReceiptFailure(db, String(receipt.id), fetched.code)
        return json({ accepted: true, status: 'failed', receiptId: receipt.id, detailCode: fetched.code })
      }
      return json({ accepted: false, status: 'verified_pending_resource_fetch', receiptId: receipt.id, error: fetched.code }, 503)
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
    return json({ accepted: true, idempotent: false, status: 'canonical_verified', receiptId: receipt.id, processing: 'no_checkout_correlation_required' })
  }

  const checkoutId = canonical.externalReference?.trim() ?? ''
  if (!UUID_RE.test(checkoutId)) {
    await markReceiptFailure(db, String(receipt.id), 'canonical_checkout_reference_missing_or_invalid')
    return json({ accepted: true, status: 'failed', receiptId: receipt.id, detailCode: 'canonical_checkout_reference_missing_or_invalid' })
  }

  const checkout = await db.prepare('SELECT * FROM academy_checkout_sessions WHERE id=? LIMIT 1').bind(checkoutId).first()
  if (!checkout) {
    await markReceiptFailure(db, String(receipt.id), 'canonical_checkout_not_found')
    return json({ accepted: true, status: 'failed', receiptId: receipt.id, detailCode: 'canonical_checkout_not_found' })
  }

  if (canonical.amountCents != null && Number(checkout.amount_cents) !== canonical.amountCents) {
    await markReceiptFailure(db, String(receipt.id), 'canonical_amount_mismatch')
    return json({ accepted: true, status: 'failed', receiptId: receipt.id, detailCode: 'canonical_amount_mismatch' })
  }
  if (canonical.currency && String(checkout.currency) !== canonical.currency) {
    await markReceiptFailure(db, String(receipt.id), 'canonical_currency_mismatch')
    return json({ accepted: true, status: 'failed', receiptId: receipt.id, detailCode: 'canonical_currency_mismatch' })
  }

  let providerSubscriptionId = canonical.providerSubscriptionId
  if (canonical.resourceType === 'preapproval') {
    if (checkout.provider_checkout_id && String(checkout.provider_checkout_id) !== canonical.resourceId) {
      await markReceiptFailure(db, String(receipt.id), 'canonical_subscription_mismatch')
      return json({ accepted: true, status: 'failed', receiptId: receipt.id, detailCode: 'canonical_subscription_mismatch' })
    }
    await db.prepare(`UPDATE academy_checkout_sessions SET provider='mercado_pago',provider_checkout_id=COALESCE(provider_checkout_id,?),
      status=CASE WHEN status='created' THEN 'awaiting_provider' ELSE status END,updated_at=? WHERE id=?`)
      .bind(canonical.resourceId, new Date().toISOString(), checkout.id).run()
    await db.prepare(`UPDATE academy_payment_webhook_receipts SET tenant_id=?,checkout_session_id=?,detail_code='canonical_preapproval_verified'
      WHERE id=?`).bind(checkout.tenant_id, checkout.id, receipt.id).run()
    return json({ accepted: true, status: 'canonical_verified', receiptId: receipt.id, processing: 'subscription_resource_correlated' })
  }

  if (canonical.resourceType === 'authorized_payment' && providerSubscriptionId) {
    if (checkout.provider_checkout_id && String(checkout.provider_checkout_id) !== providerSubscriptionId) {
      await markReceiptFailure(db, String(receipt.id), 'canonical_subscription_mismatch')
      return json({ accepted: true, status: 'failed', receiptId: receipt.id, detailCode: 'canonical_subscription_mismatch' })
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
    return json({ accepted: true, status: 'canonical_verified', receiptId: receipt.id, processing: 'no_payment_state_transition' })
  }

  if (eventType === 'confirmed' && (!canonical.providerPaymentId || !providerSubscriptionId)) {
    await db.prepare(`UPDATE academy_payment_webhook_receipts SET detail_code='confirmed_waiting_subscription_evidence' WHERE id=?`)
      .bind(receipt.id).run()
    return json({ accepted: true, status: 'canonical_verified', receiptId: receipt.id, processing: 'waiting_subscription_evidence' })
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
        providerResourceType: canonical.resourceType,
        providerResourceId: canonical.resourceId,
        periodEvidenceObservedAt: receipt.canonical_fetched_at ?? new Date().toISOString(),
        eventType,
        amountCents: canonical.amountCents,
        currency: canonical.currency,
        payloadHash: canonical.payloadHash,
        verifiedAt: new Date().toISOString(),
        periodStart: canonical.periodStart,
        periodEnd: canonical.periodEnd,
      },
    })
    await db.prepare(`UPDATE academy_payment_webhook_receipts SET status='processed',detail_code=?,last_error_code=NULL WHERE id=?`)
      .bind(`payment_${result.paymentStatus}`, receipt.id).run()
    return json({
      accepted: true,
      status: 'processed',
      receiptId: receipt.id,
      paymentStatus: result.paymentStatus,
      accessAction: result.accessAction,
      idempotent: result.idempotent,
    })
  } catch {
    await markReceiptFailure(db, String(receipt.id), 'verified_payment_processor_rejected')
    return json({ accepted: true, status: 'failed', receiptId: receipt.id, detailCode: 'verified_payment_processor_rejected' })
  }
}
