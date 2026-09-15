import { requireAdminContext } from './_auth'
import { paymentProviderReadiness } from './_payments'
import { dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin','ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const url = new URL(request.url)
  const checkoutId = url.searchParams.get('checkoutId')?.trim() ?? ''
  const limitRaw = Number(url.searchParams.get('limit') ?? 100)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 100

  const checkouts = await db.prepare(`SELECT c.*,ps.status AS payment_status,ps.provider AS payment_provider,
      ps.provider_payment_id,ps.confirmed_at,p.name AS plan_name
    FROM academy_checkout_sessions c
    JOIN academy_plans p ON p.tenant_id=c.tenant_id AND p.id=c.plan_id
    LEFT JOIN academy_payment_state ps ON ps.tenant_id=c.tenant_id AND ps.checkout_session_id=c.id
    WHERE c.tenant_id=? AND (?='' OR c.id=?)
    ORDER BY c.created_at DESC LIMIT ?`).bind(auth.tenantId, checkoutId, checkoutId, limit).all()

  const events = checkoutId
    ? await db.prepare(`SELECT id,checkout_session_id,provider,provider_event_id,event_type,provider_payment_id,provider_subscription_id,
        amount_cents,currency,payload_hash,verified_at,received_at,period_start,period_end,processing_status,processed_at,error_code
      FROM academy_payment_events WHERE tenant_id=? AND checkout_session_id=? ORDER BY received_at DESC`)
      .bind(auth.tenantId, checkoutId).all()
    : { results: [] }
  const processing = checkoutId
    ? await db.prepare(`SELECT id,payment_event_id,outcome,detail_code,created_at FROM academy_payment_processing_log
      WHERE tenant_id=? AND checkout_session_id=? ORDER BY created_at DESC`).bind(auth.tenantId, checkoutId).all()
    : { results: [] }

  return json({
    data: (checkouts.results as any[]).map((row) => ({
      id: row.id, userId: row.user_id, planId: row.plan_id, planName: row.plan_name,
      subscriptionId: row.subscription_id, billingInterval: row.billing_interval,
      priceUnit: row.price_unit, priceVersion: Number(row.price_version), amountCents: Number(row.amount_cents), currency: row.currency,
      checkoutStatus: row.status, paymentStatus: row.payment_status ?? 'pending', provider: row.payment_provider ?? row.provider ?? null,
      providerPaymentId: row.provider_payment_id ?? null, confirmedAt: row.confirmed_at ?? null,
      createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    events: (events.results as any[]).map((row) => ({
      id: row.id, checkoutSessionId: row.checkout_session_id, provider: row.provider,
      providerEventId: row.provider_event_id, eventType: row.event_type, providerPaymentId: row.provider_payment_id ?? null,
      providerSubscriptionId: row.provider_subscription_id ?? null,
      amountCents: Number(row.amount_cents), currency: row.currency, payloadHash: row.payload_hash,
      verifiedAt: row.verified_at, receivedAt: row.received_at, periodStart: row.period_start ?? null, periodEnd: row.period_end ?? null,
      processingStatus: row.processing_status, processedAt: row.processed_at ?? null, errorCode: row.error_code ?? null,
    })),
    processing: (processing.results as any[]).map((row) => ({
      id: row.id, paymentEventId: row.payment_event_id ?? null, outcome: row.outcome,
      detailCode: row.detail_code, createdAt: row.created_at,
    })),
    provider: paymentProviderReadiness(env),
    writeEnabled: false,
    refundAccessPolicy: 'tbd_no_automatic_revocation',
    note: 'Eventos são processados apenas pelo boundary server-side após verificação de provider. O browser não possui endpoint para confirmar pagamento.',
  })
}
