import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { paymentProviderReadiness } from './_payments'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ALLOWED_INTERVALS = new Set(['monthly','annual'])

function mapCheckout(row: any) {
  return {
    id: row.id,
    planId: row.plan_id,
    priceId: row.price_id,
    subscriptionId: row.subscription_id,
    billingInterval: row.billing_interval,
    priceUnit: row.price_unit,
    priceVersion: Number(row.price_version),
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    status: row.status,
    provider: row.provider ?? null,
    providerCheckoutId: row.provider_checkout_id ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const id = new URL(request.url).searchParams.get('id')?.trim() ?? ''
  const result = await db.prepare(`SELECT * FROM academy_checkout_sessions
    WHERE tenant_id=? AND user_id=? AND (?='' OR id=?)
    ORDER BY created_at DESC LIMIT 50`).bind(auth.tenantId, auth.userId, id, id).all()
  return json({ data: (result.results as any[]).map(mapCheckout), provider: paymentProviderReadiness(env) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const planId = String(body.planId ?? '').trim()
  const billingInterval = String(body.billingInterval ?? '').trim().toLowerCase()
  if (!planId || !ALLOWED_INTERVALS.has(billingInterval)) {
    return json({ error: 'planId e billingInterval válido são obrigatórios' }, 400)
  }

  const plan = await db.prepare(`SELECT id,name,commercial_mode,status FROM academy_plans
    WHERE tenant_id=? AND id=? LIMIT 1`).bind(auth.tenantId, planId).first()
  if (!plan || String(plan.status) !== 'public') return json({ error: 'Plano público não encontrado neste tenant' }, 404)
  if (String(plan.commercial_mode) !== 'priced') {
    return json({ error: 'Este plano não usa checkout de pagamento', code: 'CHECKOUT_NOT_REQUIRED' }, 409)
  }

  const price = await db.prepare(`SELECT * FROM academy_plan_prices
    WHERE tenant_id=? AND plan_id=? AND billing_interval=? AND status='active'
      AND (valid_from IS NULL OR datetime(valid_from)<=datetime('now'))
      AND (valid_until IS NULL OR datetime(valid_until)>datetime('now'))
    LIMIT 1`).bind(auth.tenantId, planId, billingInterval).first()
  if (!price) return json({ error: 'Nenhum preço ativo está disponível para este plano/período' }, 409)
  if (String(price.price_unit) !== 'subscription') {
    return json({
      error: 'Checkout por usuário ainda exige política homologada de quantidade/licenças.',
      code: 'PER_USER_CHECKOUT_NOT_READY',
    }, 409)
  }

  const existing = await db.prepare(`SELECT * FROM academy_checkout_sessions
    WHERE tenant_id=? AND user_id=? AND plan_id=? AND price_id=?
      AND status IN ('created','awaiting_provider','pending')
    ORDER BY created_at DESC LIMIT 1`).bind(auth.tenantId, auth.userId, planId, price.id).first()
  if (existing) {
    return json({ data: mapCheckout(existing), idempotent: true, provider: paymentProviderReadiness(env) })
  }

  const checkoutId = crypto.randomUUID()
  const subscriptionId = crypto.randomUUID()
  const paymentStateId = checkoutId
  const now = new Date().toISOString()
  const statements: any[] = [
    db.prepare(`INSERT INTO academy_subscriptions
      (id,tenant_id,user_id,plan_id,price_id,status,created_at,updated_at)
      VALUES (?,?,?,?,?,'pending_payment',?,?)`).bind(
      subscriptionId, auth.tenantId, auth.userId, planId, price.id, now, now,
    ),
    db.prepare(`INSERT INTO academy_checkout_sessions
      (id,tenant_id,user_id,plan_id,price_id,subscription_id,billing_interval,price_unit,price_version,amount_cents,currency,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'created',?,?)`).bind(
      checkoutId, auth.tenantId, auth.userId, planId, price.id, subscriptionId,
      price.billing_interval, price.price_unit, Number(price.version), Number(price.amount_cents), price.currency, now, now,
    ),
    db.prepare(`INSERT INTO academy_payment_state
      (checkout_session_id,tenant_id,status,amount_cents,currency,updated_at)
      VALUES (?,?,'pending',?,?,?)`).bind(paymentStateId, auth.tenantId, Number(price.amount_cents), price.currency, now),
    auditStatement(db, auth, {
      action: 'checkout.created', resourceType: 'checkout_session', resourceId: checkoutId,
      metadata: { planId, priceId: price.id, billingInterval, priceVersion: Number(price.version) },
    }),
  ]
  try { await db.batch(statements) }
  catch { return json({ error: 'Não foi possível criar o checkout local' }, 409) }

  const created = await db.prepare('SELECT * FROM academy_checkout_sessions WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, checkoutId).first()
  return json({
    data: mapCheckout(created),
    idempotent: false,
    provider: paymentProviderReadiness(env),
    note: 'Nenhum pagamento foi iniciado. A sessão local preserva o preço do servidor até a homologação do provider.',
  }, 201)
}
