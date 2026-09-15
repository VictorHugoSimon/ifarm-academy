import { nextPaymentStatus, normalizeVerifiedPaymentEvent, type PaymentStatus } from './_payments'

export interface PaymentProcessingResult {
  idempotent: boolean
  paymentStatus: PaymentStatus
  subscriptionStatus: string
  entitlementStatus: string | null
  accessAction: 'activated' | 'unchanged' | 'unchanged_refund_policy_tbd'
  eventId: string
}

function asStatus(value: unknown): PaymentStatus {
  const text = String(value ?? 'pending') as PaymentStatus
  return ['pending','confirmed','failed','cancelled','refunded'].includes(text) ? text : 'pending'
}

function billingEvidenceStatus(periodStart?: string | null, periodEnd?: string | null): 'complete' | 'partial' | 'unavailable' {
  if (periodStart && periodEnd) return 'complete'
  if (periodStart || periodEnd) return 'partial'
  return 'unavailable'
}

export async function processVerifiedPaymentEvent(
  db: any,
  input: { tenantId: string; checkoutSessionId: string; event: Record<string, unknown> },
): Promise<PaymentProcessingResult> {
  const event = normalizeVerifiedPaymentEvent(input.event)
  if (!event) throw new Error('INVALID_VERIFIED_PAYMENT_EVENT')

  const existing = await db.prepare(`SELECT id,event_type,checkout_session_id FROM academy_payment_events
    WHERE tenant_id=? AND provider=? AND provider_event_id=? LIMIT 1`)
    .bind(input.tenantId, event.provider, event.providerEventId).first()
  if (existing) {
    if (String(existing.checkout_session_id) !== input.checkoutSessionId) throw new Error('PROVIDER_EVENT_CHECKOUT_MISMATCH')
    const state = await db.prepare('SELECT status FROM academy_payment_state WHERE tenant_id=? AND checkout_session_id=? LIMIT 1')
      .bind(input.tenantId, input.checkoutSessionId).first()
    const checkout = await db.prepare('SELECT subscription_id FROM academy_checkout_sessions WHERE tenant_id=? AND id=? LIMIT 1')
      .bind(input.tenantId, input.checkoutSessionId).first()
    const subscription = checkout
      ? await db.prepare('SELECT status FROM academy_subscriptions WHERE tenant_id=? AND id=? LIMIT 1').bind(input.tenantId, checkout.subscription_id).first()
      : null
    const entitlement = checkout
      ? await db.prepare(`SELECT status FROM academy_entitlements WHERE tenant_id=? AND source_type='subscription' AND source_id=? LIMIT 1`)
        .bind(input.tenantId, checkout.subscription_id).first()
      : null
    return {
      idempotent: true,
      paymentStatus: asStatus(state?.status),
      subscriptionStatus: String(subscription?.status ?? 'unknown'),
      entitlementStatus: entitlement?.status ? String(entitlement.status) : null,
      accessAction: 'unchanged',
      eventId: String(existing.id),
    }
  }

  const checkout = await db.prepare(`SELECT c.*,s.status AS subscription_status
    FROM academy_checkout_sessions c
    JOIN academy_subscriptions s ON s.tenant_id=c.tenant_id AND s.id=c.subscription_id
    WHERE c.tenant_id=? AND c.id=? LIMIT 1`).bind(input.tenantId, input.checkoutSessionId).first()
  if (!checkout) throw new Error('CHECKOUT_NOT_FOUND')
  if (Number(checkout.amount_cents) !== event.amountCents || String(checkout.currency) !== event.currency) throw new Error('PAYMENT_AMOUNT_MISMATCH')

  const state = await db.prepare('SELECT * FROM academy_payment_state WHERE tenant_id=? AND checkout_session_id=? LIMIT 1')
    .bind(input.tenantId, input.checkoutSessionId).first()
  if (!state) throw new Error('PAYMENT_STATE_NOT_FOUND')
  const next = nextPaymentStatus(asStatus(state.status), event.eventType)
  const eventId = crypto.randomUUID()
  const logId = crypto.randomUUID()
  const now = new Date().toISOString()
  const activationReference = `verified-provider-event:${event.provider}:${event.providerEventId}`
  const statements: any[] = [
    db.prepare(`INSERT INTO academy_payment_events
      (id,tenant_id,checkout_session_id,provider,provider_event_id,event_type,provider_payment_id,provider_subscription_id,
       amount_cents,currency,payload_hash,verified_at,received_at,period_start,period_end,processing_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'received')`).bind(
      eventId, input.tenantId, input.checkoutSessionId, event.provider, event.providerEventId, event.eventType,
      event.providerPaymentId ?? null, event.providerSubscriptionId ?? null, event.amountCents, event.currency,
      event.payloadHash, event.verifiedAt, now, event.periodStart ?? null, event.periodEnd ?? null,
    ),
    db.prepare(`UPDATE academy_payment_state SET status=?,provider=?,provider_payment_id=?,last_event_id=?,
      confirmed_at=CASE WHEN ?='confirmed' THEN ? ELSE confirmed_at END,updated_at=?
      WHERE tenant_id=? AND checkout_session_id=?`).bind(
      next, event.provider, event.providerPaymentId ?? null, eventId, next, next === 'confirmed' ? event.verifiedAt : null,
      now, input.tenantId, input.checkoutSessionId,
    ),
  ]

  let accessAction: PaymentProcessingResult['accessAction'] = 'unchanged'
  if (next === 'confirmed') {
    const accessStartsAt = event.periodStart ?? event.verifiedAt
    if (event.providerResourceType && event.providerResourceId && event.providerSubscriptionId) {
      statements.push(
        db.prepare(`INSERT INTO academy_subscription_billing_period_evidence
          (id,tenant_id,subscription_id,checkout_session_id,payment_event_id,provider,provider_resource_type,
           provider_resource_id,provider_subscription_id,evidence_status,period_start,period_end,observed_at,payload_hash,source,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'canonical_provider_resource',?)`).bind(
          crypto.randomUUID(), input.tenantId, checkout.subscription_id, input.checkoutSessionId, eventId, event.provider,
          event.providerResourceType, event.providerResourceId, event.providerSubscriptionId,
          billingEvidenceStatus(event.periodStart, event.periodEnd), event.periodStart ?? null, event.periodEnd ?? null,
          event.periodEvidenceObservedAt ?? event.verifiedAt, event.payloadHash, now,
        ),
      )
    }
    statements.push(
      db.prepare(`UPDATE academy_checkout_sessions SET status='confirmed',provider=?,provider_checkout_id=COALESCE(provider_checkout_id,?),updated_at=?
        WHERE tenant_id=? AND id=?`).bind(event.provider, event.providerPaymentId ?? null, now, input.tenantId, input.checkoutSessionId),
      db.prepare(`UPDATE academy_subscriptions SET status='active',provider=?,provider_subscription_id=?,activation_reference=?,
        started_at=COALESCE(started_at,?),current_period_start=?,current_period_end=?,updated_at=?
        WHERE tenant_id=? AND id=? AND status IN ('pending_payment','past_due')`).bind(
        event.provider, event.providerSubscriptionId, activationReference, accessStartsAt, event.periodStart ?? null, event.periodEnd ?? null,
        now, input.tenantId, checkout.subscription_id,
      ),
      db.prepare(`INSERT INTO academy_entitlements
        (id,tenant_id,user_id,source_type,source_id,plan_id,status,activation_evidence_type,activation_reference,starts_at,ends_at,created_at,updated_at)
        VALUES (?,?,?,'subscription',?,?,'active','verified_provider_event',?,?,?,?,?)
        ON CONFLICT(tenant_id,user_id,source_type,source_id) DO UPDATE SET
          status='active',activation_evidence_type='verified_provider_event',activation_reference=excluded.activation_reference,
          starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=excluded.updated_at`).bind(
        crypto.randomUUID(), input.tenantId, checkout.user_id, checkout.subscription_id, checkout.plan_id,
        activationReference, accessStartsAt, event.periodEnd ?? null, now, now,
      ),
    )
    accessAction = 'activated'
  } else if (next === 'failed' || next === 'cancelled') {
    statements.push(db.prepare(`UPDATE academy_checkout_sessions SET status=?,provider=?,updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(next, event.provider, now, input.tenantId, input.checkoutSessionId))
  } else if (next === 'pending') {
    statements.push(db.prepare(`UPDATE academy_checkout_sessions SET status='pending',provider=?,updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(event.provider, now, input.tenantId, input.checkoutSessionId))
  } else if (next === 'refunded') {
    accessAction = 'unchanged_refund_policy_tbd'
  }

  statements.push(
    db.prepare(`UPDATE academy_payment_events SET processing_status='processed',processed_at=? WHERE tenant_id=? AND id=?`)
      .bind(now, input.tenantId, eventId),
    db.prepare(`INSERT INTO academy_payment_processing_log
      (id,tenant_id,checkout_session_id,payment_event_id,outcome,detail_code,created_at)
      VALUES (?,?,?,?,?,?,?)`).bind(logId, input.tenantId, input.checkoutSessionId, eventId, 'applied', `payment_${next}`, now),
  )

  try { await db.batch(statements) }
  catch (error) {
    const duplicate = await db.prepare(`SELECT id,checkout_session_id FROM academy_payment_events WHERE tenant_id=? AND provider=? AND provider_event_id=? LIMIT 1`)
      .bind(input.tenantId, event.provider, event.providerEventId).first()
    if (duplicate) {
      if (String(duplicate.checkout_session_id) !== input.checkoutSessionId) throw new Error('PROVIDER_EVENT_CHECKOUT_MISMATCH')
      return processVerifiedPaymentEvent(db, input)
    }
    throw error
  }

  const subscription = await db.prepare('SELECT status FROM academy_subscriptions WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(input.tenantId, checkout.subscription_id).first()
  const entitlement = await db.prepare(`SELECT status FROM academy_entitlements WHERE tenant_id=? AND source_type='subscription' AND source_id=? LIMIT 1`)
    .bind(input.tenantId, checkout.subscription_id).first()
  return {
    idempotent: false,
    paymentStatus: next,
    subscriptionStatus: String(subscription?.status ?? checkout.subscription_status ?? 'unknown'),
    entitlementStatus: entitlement?.status ? String(entitlement.status) : null,
    accessAction,
    eventId,
  }
}
