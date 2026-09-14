import {
  classifyMercadoPagoNotificationType,
  normalizeMercadoPagoDataId,
  sha256Hex,
  verifyMercadoPagoWebhookSignature,
} from '../../_mercadoPagoWebhook'
import { dbOr503, json, type Env } from '../../_shared'

const MAX_BODY_CHARS = 128_000

function safeText(value: unknown, max: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  return text && text.length <= max ? text : null
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
  const existing = await db.prepare(`SELECT id,status FROM academy_payment_webhook_receipts
    WHERE provider='mercado_pago' AND request_id=? LIMIT 1`).bind(requestId).first()
  if (existing) return json({ accepted: true, idempotent: true, status: existing.status })

  const classification = classifyMercadoPagoNotificationType(bodyType)
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
    const raced = await db.prepare(`SELECT id,status FROM academy_payment_webhook_receipts
      WHERE provider='mercado_pago' AND request_id=? LIMIT 1`).bind(requestId).first()
    if (raced) return json({ accepted: true, idempotent: true, status: raced.status })
    return json({ error: 'WEBHOOK_RECEIPT_PERSISTENCE_FAILED' }, 503)
  }

  return json({
    accepted: true,
    idempotent: false,
    status,
    receiptId,
    processing: classification === 'supported' ? 'canonical_resource_fetch_required' : 'ignored',
  })
}
