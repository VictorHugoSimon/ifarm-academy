import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import {
  createMercadoPagoPendingSubscription,
  resolveCorePayerEmail,
} from './_mercadoPagoCheckout'
import { sha256Hex } from './_mercadoPagoWebhook'
import { paymentProviderReadiness } from './_payments'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const STALE_REQUEST_MS = 60_000

function mapProviderSession(row: any) {
  return {
    checkoutId: row.checkout_session_id,
    provider: row.provider,
    status: row.status,
    providerCheckoutId: row.provider_resource_id ?? null,
    checkoutUrl: row.provider_checkout_url ?? null,
    providerStatus: row.provider_status ?? null,
    attemptCount: Number(row.attempt_count ?? 0),
    updatedAt: row.updated_at,
  }
}

function retryableHttpStatus(code: string): number {
  if (code === 'auth_required') return 401
  if (code === 'payer_email_unavailable') return 409
  if (code === 'checkout_disabled' || code === 'provider_not_configured' || code === 'return_url_not_configured' || code === 'core_not_configured') return 503
  if (code === 'invalid_checkout_input' || code === 'unsupported_currency' || code === 'provider_rejected' || code === 'provider_resource_mismatch') return 409
  return 503
}

async function markFailed(db: any, tenantId: string, checkoutId: string, code: string, now: string) {
  await db.prepare(`UPDATE academy_checkout_provider_sessions
    SET status='failed',last_error_code=?,updated_at=?
    WHERE tenant_id=? AND checkout_session_id=? AND status!='created'`)
    .bind(code, now, tenantId, checkoutId).run()
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const readiness = paymentProviderReadiness(env)
  if (!readiness.checkoutEnabled) {
    return json({ error: 'Checkout externo não está habilitado neste ambiente.', code: 'CHECKOUT_PROVIDER_NOT_READY', provider: readiness }, 503)
  }

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const checkoutId = String(body.checkoutId ?? '').trim()
  if (!checkoutId) return json({ error: 'checkoutId é obrigatório' }, 400)

  const checkout = await db.prepare(`SELECT c.*,p.name AS plan_name
    FROM academy_checkout_sessions c
    JOIN academy_plans p ON p.tenant_id=c.tenant_id AND p.id=c.plan_id
    WHERE c.tenant_id=? AND c.user_id=? AND c.id=? LIMIT 1`)
    .bind(auth.tenantId, auth.userId, checkoutId).first()
  if (!checkout) return json({ error: 'Checkout não encontrado' }, 404)
  if (!['created','awaiting_provider','pending'].includes(String(checkout.status))) {
    return json({ error: 'Checkout não está disponível para iniciação no provider', code: 'CHECKOUT_NOT_OPEN' }, 409)
  }
  if (String(checkout.price_unit) !== 'subscription') {
    return json({ error: 'Somente preço por assinatura está habilitado no provider nesta versão', code: 'CHECKOUT_PRICE_UNIT_UNSUPPORTED' }, 409)
  }

  const requestHash = await sha256Hex(JSON.stringify({
    checkoutId,
    planId: checkout.plan_id,
    priceId: checkout.price_id,
    billingInterval: checkout.billing_interval,
    priceVersion: Number(checkout.price_version),
    amountCents: Number(checkout.amount_cents),
    currency: String(checkout.currency).toUpperCase(),
  }))
  const now = new Date().toISOString()
  let providerSession = await db.prepare(`SELECT * FROM academy_checkout_provider_sessions
    WHERE tenant_id=? AND checkout_session_id=? LIMIT 1`).bind(auth.tenantId, checkoutId).first()

  if (providerSession?.status === 'created') {
    return json({ data: mapProviderSession(providerSession), idempotent: true, provider: readiness })
  }
  if (providerSession && String(providerSession.request_hash) !== requestHash) {
    return json({ error: 'O snapshot do checkout diverge da solicitação já registrada.', code: 'CHECKOUT_REQUEST_MISMATCH' }, 409)
  }
  if (providerSession?.status === 'requesting') {
    const age = Date.now() - Date.parse(String(providerSession.updated_at ?? ''))
    if (Number.isFinite(age) && age >= 0 && age < STALE_REQUEST_MS) {
      return json({ error: 'Checkout já está sendo iniciado no provider.', code: 'CHECKOUT_PROVIDER_IN_PROGRESS' }, 409)
    }
  }

  try {
    if (!providerSession) {
      await db.batch([
        db.prepare(`INSERT INTO academy_checkout_provider_sessions
          (checkout_session_id,tenant_id,provider,idempotency_key,request_hash,status,attempt_count,created_at,updated_at)
          VALUES (?,?,'mercado_pago',?,?,'requesting',1,?,?)`)
          .bind(checkoutId, auth.tenantId, checkoutId, requestHash, now, now),
        db.prepare(`UPDATE academy_checkout_sessions SET status='awaiting_provider',provider='mercado_pago',updated_at=?
          WHERE tenant_id=? AND id=? AND status='created'`).bind(now, auth.tenantId, checkoutId),
      ])
    } else {
      await db.prepare(`UPDATE academy_checkout_provider_sessions
        SET status='requesting',attempt_count=attempt_count+1,last_error_code=NULL,updated_at=?
        WHERE tenant_id=? AND checkout_session_id=? AND status!='created'`)
        .bind(now, auth.tenantId, checkoutId).run()
    }
  } catch {
    providerSession = await db.prepare(`SELECT * FROM academy_checkout_provider_sessions
      WHERE tenant_id=? AND checkout_session_id=? LIMIT 1`).bind(auth.tenantId, checkoutId).first()
    if (providerSession?.status === 'created') {
      return json({ data: mapProviderSession(providerSession), idempotent: true, provider: readiness })
    }
    return json({ error: 'Não foi possível reservar a iniciação do checkout no provider.' }, 409)
  }

  const payer = await resolveCorePayerEmail(env, request)
  if (!payer.ok) {
    await markFailed(db, auth.tenantId, checkoutId, payer.code, new Date().toISOString())
    return json({ error: 'O iFarm Core não forneceu um e-mail válido para iniciar a assinatura.', code: payer.code }, retryableHttpStatus(payer.code))
  }

  const providerResult = await createMercadoPagoPendingSubscription(env, {
    checkoutId,
    idempotencyKey: checkoutId,
    planName: String(checkout.plan_name ?? 'iFarm Academy'),
    billingInterval: String(checkout.billing_interval) as 'monthly' | 'annual',
    amountCents: Number(checkout.amount_cents),
    currency: String(checkout.currency),
    payerEmail: payer.email,
  })

  if (!providerResult.ok) {
    await markFailed(db, auth.tenantId, checkoutId, providerResult.code, new Date().toISOString())
    return json({
      error: providerResult.retryable
        ? 'O provider não concluiu a criação agora. A mesma sessão pode ser tentada novamente com segurança.'
        : 'O provider recusou ou invalidou a criação do checkout.',
      code: providerResult.code,
      retryable: providerResult.retryable,
    }, retryableHttpStatus(providerResult.code))
  }

  const completedAt = new Date().toISOString()
  try {
    await db.batch([
      db.prepare(`UPDATE academy_checkout_provider_sessions
        SET status='created',provider_resource_id=?,provider_checkout_url=?,provider_status=?,response_hash=?,last_error_code=NULL,updated_at=?
        WHERE tenant_id=? AND checkout_session_id=? AND status!='created'`)
        .bind(providerResult.resourceId, providerResult.checkoutUrl, providerResult.providerStatus,
          providerResult.responseHash, completedAt, auth.tenantId, checkoutId),
      db.prepare(`UPDATE academy_checkout_sessions
        SET status='pending',provider='mercado_pago',provider_checkout_id=?,updated_at=?
        WHERE tenant_id=? AND id=? AND status IN ('created','awaiting_provider','pending')`)
        .bind(providerResult.resourceId, completedAt, auth.tenantId, checkoutId),
      db.prepare(`UPDATE academy_subscriptions
        SET provider='mercado_pago',provider_subscription_id=?,updated_at=?
        WHERE tenant_id=? AND id=? AND status='pending_payment'`)
        .bind(providerResult.resourceId, completedAt, auth.tenantId, checkout.subscription_id),
      auditStatement(db, auth, {
        action: 'checkout.provider_created',
        resourceType: 'checkout_session',
        resourceId: checkoutId,
        metadata: { provider: 'mercado_pago', providerStatus: providerResult.providerStatus },
      }),
    ])
  } catch {
    return json({
      error: 'O provider criou a assinatura, mas a persistência local não foi concluída. Repetir usa a mesma chave de idempotência.',
      code: 'CHECKOUT_PROVIDER_PERSISTENCE_RETRY',
      retryable: true,
    }, 503)
  }

  const saved = await db.prepare(`SELECT * FROM academy_checkout_provider_sessions
    WHERE tenant_id=? AND checkout_session_id=? LIMIT 1`).bind(auth.tenantId, checkoutId).first()
  return json({ data: mapProviderSession(saved), idempotent: false, provider: readiness }, 201)
}
