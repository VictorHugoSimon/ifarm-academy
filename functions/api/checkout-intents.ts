import { requireTrustedContext } from './_auth'
import {
  normalizeIdempotencyKey,
  parseCheckoutItems,
  summarizeResolvedItems,
  type CheckoutRequestItem,
  type ResolvedCheckoutItem,
} from './_checkout'
import { bodyJson, dbOr503, json, type Env } from './_shared'

async function loadOrder(db: any, tenantId: string, userId: string, orderId?: string, idempotencyKey?: string) {
  const where = orderId ? 'id=?' : 'idempotency_key=?'
  const value = orderId ?? idempotencyKey
  const order = await db.prepare(`
    SELECT id, tenant_id, user_id, idempotency_key, status, total_amount_cents, currency,
           item_count, created_at, updated_at, confirmed_at, cancelled_at
    FROM academy_orders
    WHERE tenant_id=? AND user_id=? AND ${where}
    LIMIT 1
  `).bind(tenantId, userId, value).first()
  if (!order) return null
  const rows = await db.prepare(`
    SELECT id, product_type, product_id, price_ref, description_snapshot, quantity,
           unit_amount_cents, total_amount_cents, currency, created_at
    FROM academy_order_items
    WHERE tenant_id=? AND order_id=?
    ORDER BY created_at, id
  `).bind(tenantId, String(order.id)).all()
  return {
    id: String(order.id),
    status: String(order.status),
    totalAmountCents: Number(order.total_amount_cents),
    currency: String(order.currency),
    itemCount: Number(order.item_count),
    idempotencyKey: String(order.idempotency_key),
    createdAt: String(order.created_at),
    updatedAt: String(order.updated_at),
    confirmedAt: order.confirmed_at ? String(order.confirmed_at) : null,
    cancelledAt: order.cancelled_at ? String(order.cancelled_at) : null,
    items: (rows.results as any[]).map((row) => ({
      id: String(row.id),
      productType: String(row.product_type),
      productId: String(row.product_id),
      priceRef: row.price_ref ? String(row.price_ref) : null,
      description: String(row.description_snapshot),
      quantity: Number(row.quantity),
      unitAmountCents: Number(row.unit_amount_cents),
      totalAmountCents: Number(row.total_amount_cents),
      currency: String(row.currency),
    })),
    paymentAdapter: { available: false, provider: null, checkoutUrl: null },
    entitlementCreated: false,
  }
}

async function resolveItem(db: any, tenantId: string, userId: string, item: CheckoutRequestItem): Promise<ResolvedCheckoutItem> {
  if (item.productType === 'course') {
    if (item.quantity !== 1) throw new Error('course_quantity_must_be_one')
    const existing = await db.prepare(`
      SELECT id FROM academy_enrollments
      WHERE tenant_id=? AND student_id=? AND course_id=? AND status IN ('active','completed') LIMIT 1
    `).bind(tenantId, userId, item.productId).first()
    if (existing) throw new Error('course_already_entitled')
    const row = await db.prepare(`
      SELECT c.title, p.list_price_cents, p.currency
      FROM academy_course_public_profiles p
      JOIN academy_courses c ON c.id=p.course_id AND c.tenant_id=p.tenant_id
      WHERE p.tenant_id=? AND p.course_id=? AND p.visibility='public' AND p.access_model='paid'
        AND c.status='published' AND p.list_price_cents>0
      LIMIT 1
    `).bind(tenantId, item.productId).first()
    if (!row) throw new Error('course_not_purchasable')
    const unit = Number(row.list_price_cents)
    return { ...item, priceRef: null, description: String(row.title), unitAmountCents: unit, totalAmountCents: unit, currency: String(row.currency) }
  }

  if (item.productType === 'plan') {
    const active = await db.prepare(`
      SELECT id FROM academy_subscriptions
      WHERE tenant_id=? AND user_id=? AND plan_id=? AND status IN ('active','past_due') LIMIT 1
    `).bind(tenantId, userId, item.productId).first()
    if (active) throw new Error('plan_already_entitled')
    const row = await db.prepare(`
      SELECT p.name, pp.id AS price_id, pp.amount_cents, pp.currency, pp.price_unit
      FROM academy_plans p
      JOIN academy_plan_prices pp ON pp.plan_id=p.id AND pp.tenant_id=p.tenant_id
      WHERE p.tenant_id=? AND p.id=? AND p.status='public' AND p.commercial_mode='priced'
        AND pp.billing_interval=? AND pp.status='active'
        AND (pp.valid_from IS NULL OR datetime(pp.valid_from)<=datetime('now'))
        AND (pp.valid_until IS NULL OR datetime(pp.valid_until)>datetime('now'))
      LIMIT 1
    `).bind(tenantId, item.productId, item.billingInterval).first()
    if (!row) throw new Error('plan_not_purchasable')
    if (String(row.price_unit) === 'subscription' && item.quantity !== 1) throw new Error('subscription_quantity_must_be_one')
    const unit = Number(row.amount_cents)
    return {
      ...item,
      priceRef: String(row.price_id),
      description: String(row.name),
      unitAmountCents: unit,
      totalAmountCents: unit * item.quantity,
      currency: String(row.currency),
    }
  }

  if (item.quantity !== 1) throw new Error('event_quantity_must_be_one')
  const existing = await db.prepare(`
    SELECT id FROM academy_event_registrations
    WHERE tenant_id=? AND user_id=? AND event_id=? AND status NOT IN ('cancelled','no_show') LIMIT 1
  `).bind(tenantId, userId, item.productId).first()
  if (existing) throw new Error('event_already_entitled')
  const row = await db.prepare(`
    SELECT title, price_cents, currency, starts_at, registration_deadline
    FROM academy_events
    WHERE tenant_id=? AND id=? AND status='published' AND access_model='paid' AND price_cents>0
      AND datetime(starts_at)>datetime('now')
      AND (registration_deadline IS NULL OR datetime(registration_deadline)>datetime('now'))
    LIMIT 1
  `).bind(tenantId, item.productId).first()
  if (!row) throw new Error('event_not_purchasable')
  const unit = Number(row.price_cents)
  return { ...item, priceRef: null, description: String(row.title), unitAmountCents: unit, totalAmountCents: unit, currency: String(row.currency) }
}

function publicCheckoutError(error: unknown) {
  const code = error instanceof Error ? error.message : 'checkout_invalid'
  const status = code.includes('already_entitled') ? 409 : code.includes('not_purchasable') ? 409 : 400
  return json({ error: code }, status)
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const rows = await db.prepare(`
    SELECT id FROM academy_orders
    WHERE tenant_id=? AND user_id=?
    ORDER BY created_at DESC LIMIT 50
  `).bind(auth.tenantId, auth.userId).all()
  const orders = []
  for (const row of rows.results as any[]) {
    const order = await loadOrder(db, auth.tenantId, auth.userId, String(row.id))
    if (order) orders.push(order)
  }
  return json({ data: orders })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const idempotencyKey = normalizeIdempotencyKey(request.headers.get('idempotency-key'))
  if (!idempotencyKey) return json({ error: 'Idempotency-Key válido é obrigatório' }, 400)

  const existing = await loadOrder(db, auth.tenantId, auth.userId, undefined, idempotencyKey)
  if (existing) return json({ data: existing, idempotent: true })

  let body: Record<string, unknown>
  let requested: CheckoutRequestItem[]
  try {
    body = await bodyJson(request)
    requested = parseCheckoutItems(body.items)
  } catch (error) {
    return publicCheckoutError(error)
  }

  try {
    const resolved: ResolvedCheckoutItem[] = []
    for (const item of requested) resolved.push(await resolveItem(db, auth.tenantId, auth.userId, item))
    const summary = summarizeResolvedItems(resolved)
    const orderId = `ORD-${crypto.randomUUID()}`
    const now = new Date().toISOString()
    const statements = [
      db.prepare(`
        INSERT INTO academy_orders (
          id,tenant_id,user_id,idempotency_key,status,total_amount_cents,currency,item_count,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
      `).bind(orderId, auth.tenantId, auth.userId, idempotencyKey, 'building', summary.totalAmountCents, summary.currency, summary.itemCount, now, now),
      ...resolved.map((item) => db.prepare(`
        INSERT INTO academy_order_items (
          id,tenant_id,order_id,product_type,product_id,price_ref,description_snapshot,quantity,
          unit_amount_cents,total_amount_cents,currency,created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        `OI-${crypto.randomUUID()}`, auth.tenantId, orderId, item.productType, item.productId,
        item.priceRef, item.description, item.quantity, item.unitAmountCents, item.totalAmountCents, item.currency, now,
      )),
      db.prepare(`UPDATE academy_orders SET status='awaiting_payment', updated_at=? WHERE id=? AND tenant_id=?`)
        .bind(now, orderId, auth.tenantId),
    ]
    await db.batch(statements)
    const order = await loadOrder(db, auth.tenantId, auth.userId, orderId)
    return json({
      data: order,
      idempotent: false,
      message: 'Pedido criado com snapshot de preço. O adapter de pagamento ainda não está habilitado; nenhum entitlement foi criado.',
    }, 201)
  } catch (error) {
    return publicCheckoutError(error)
  }
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const orderId = (new URL(request.url).searchParams.get('orderId') ?? '').trim()
  if (!orderId) return json({ error: 'orderId é obrigatório' }, 400)
  const order = await loadOrder(db, auth.tenantId, auth.userId, orderId)
  if (!order) return json({ error: 'Pedido não encontrado' }, 404)
  if (!['building','awaiting_payment'].includes(order.status)) return json({ error: 'Pedido não pode ser cancelado neste estado' }, 409)
  const now = new Date().toISOString()
  await db.prepare(`
    UPDATE academy_orders SET status='cancelled', cancelled_at=?, updated_at=?
    WHERE id=? AND tenant_id=? AND user_id=?
  `).bind(now, now, orderId, auth.tenantId, auth.userId).run()
  return json({ data: await loadOrder(db, auth.tenantId, auth.userId, orderId) })
}
