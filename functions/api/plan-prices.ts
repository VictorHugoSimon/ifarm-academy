import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { normalizePlanPrice } from './_plans'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin','ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const planId = new URL(request.url).searchParams.get('planId')?.trim() ?? ''
  const result = await db.prepare(`SELECT pp.*,p.name AS plan_name,p.commercial_mode,p.status AS plan_status
    FROM academy_plan_prices pp JOIN academy_plans p ON p.tenant_id=pp.tenant_id AND p.id=pp.plan_id
    WHERE pp.tenant_id=? AND (?='' OR pp.plan_id=?)
    ORDER BY p.name,pp.billing_interval,pp.version DESC`).bind(auth.tenantId, planId, planId).all()
  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id, planId: row.plan_id, planName: row.plan_name, commercialMode: row.commercial_mode, planStatus: row.plan_status,
    billingInterval: row.billing_interval, priceUnit: row.price_unit, version: Number(row.version), amountCents: Number(row.amount_cents), currency: row.currency,
    status: row.status, validFrom: row.valid_from ?? null, validUntil: row.valid_until ?? null, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const planId = String(body.planId ?? '').trim()
  const normalized = normalizePlanPrice(body)
  if (!planId || !normalized) return json({ error: 'planId ou preço inválido' }, 400)
  const plan = await db.prepare('SELECT * FROM academy_plans WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId, planId).first()
  if (!plan) return json({ error: 'Plano não encontrado neste tenant' }, 404)
  if (String(plan.commercial_mode) !== 'priced') return json({ error: 'Somente plano priced aceita preço' }, 409)

  const validFrom = String(body.validFrom ?? '').trim() || null
  const validUntil = String(body.validUntil ?? '').trim() || null
  if (validFrom && Number.isNaN(Date.parse(validFrom))) return json({ error: 'validFrom inválido' }, 400)
  if (validUntil && Number.isNaN(Date.parse(validUntil))) return json({ error: 'validUntil inválido' }, 400)
  if (validFrom && validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) return json({ error: 'Janela de validade inválida' }, 400)

  const latest = await db.prepare('SELECT COALESCE(MAX(version),0) AS v FROM academy_plan_prices WHERE tenant_id=? AND plan_id=? AND billing_interval=?')
    .bind(auth.tenantId, planId, normalized.billingInterval).first()
  const version = Number(latest?.v ?? 0) + 1
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const activate = body.activate === true
  const statements: any[] = []
  if (activate) statements.push(db.prepare("UPDATE academy_plan_prices SET status='retired',updated_at=? WHERE tenant_id=? AND plan_id=? AND billing_interval=? AND status='active'").bind(now, auth.tenantId, planId, normalized.billingInterval))
  statements.push(db.prepare(`INSERT INTO academy_plan_prices
    (id,tenant_id,plan_id,billing_interval,price_unit,version,amount_cents,currency,status,valid_from,valid_until,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,'BRL',?,?,?,?,?,?)`).bind(
      id, auth.tenantId, planId, normalized.billingInterval, normalized.priceUnit, version, normalized.amountCents,
      activate ? 'active' : 'draft', validFrom, validUntil, auth.userId, now, now,
    ))
  statements.push(auditStatement(db, auth, {
    action: activate ? 'plan_price.created_active' : 'plan_price.created_draft', resourceType: 'plan_price', resourceId: id,
    metadata: { planId, billingInterval: normalized.billingInterval, priceUnit: normalized.priceUnit, version, amountCents: normalized.amountCents, currency: 'BRL' },
  }))
  try { await db.batch(statements) } catch { return json({ error: 'Não foi possível criar a nova versão de preço' }, 409) }
  return json({ data: { id, planId, billingInterval: normalized.billingInterval, priceUnit: normalized.priceUnit, version, amountCents: normalized.amountCents, currency: 'BRL', status: activate ? 'active' : 'draft', validFrom, validUntil, createdAt: now } }, 201)
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const priceId = String(body.priceId ?? '').trim()
  const action = String(body.action ?? '').trim()
  if (!priceId || !['activate','retire'].includes(action)) return json({ error: 'priceId/action inválido' }, 400)

  const price = await db.prepare(`SELECT pp.*,p.status AS plan_status,p.commercial_mode FROM academy_plan_prices pp
    JOIN academy_plans p ON p.tenant_id=pp.tenant_id AND p.id=pp.plan_id
    WHERE pp.tenant_id=? AND pp.id=? LIMIT 1`).bind(auth.tenantId, priceId).first()
  if (!price) return json({ error: 'Preço não encontrado neste tenant' }, 404)
  if (String(price.commercial_mode) !== 'priced') return json({ error: 'Plano não aceita preço' }, 409)
  if (String(price.status) === 'retired' && action === 'activate') return json({ error: 'Versão aposentada não pode ser reativada' }, 409)
  if (action === 'retire' && String(price.status) === 'active' && String(price.plan_status) === 'public') {
    return json({ error: 'Plano público priced precisa manter um preço ativo; ative uma nova versão em vez de aposentar isoladamente' }, 409)
  }
  if (action === 'activate' && price.valid_until && Date.parse(String(price.valid_until)) <= Date.now()) return json({ error: 'Preço expirado não pode ser ativado' }, 409)

  const now = new Date().toISOString()
  const statements: any[] = []
  if (action === 'activate') {
    statements.push(db.prepare("UPDATE academy_plan_prices SET status='retired',updated_at=? WHERE tenant_id=? AND plan_id=? AND billing_interval=? AND status='active' AND id!=?")
      .bind(now, auth.tenantId, price.plan_id, price.billing_interval, priceId))
    statements.push(db.prepare("UPDATE academy_plan_prices SET status='active',updated_at=? WHERE tenant_id=? AND id=? AND status='draft'").bind(now, auth.tenantId, priceId))
  } else {
    statements.push(db.prepare("UPDATE academy_plan_prices SET status='retired',updated_at=? WHERE tenant_id=? AND id=? AND status!='retired'").bind(now, auth.tenantId, priceId))
  }
  statements.push(auditStatement(db, auth, { action: `plan_price.${action === 'activate' ? 'activated' : 'retired'}`, resourceType: 'plan_price', resourceId: priceId, metadata: { planId: price.plan_id, billingInterval: price.billing_interval, version: Number(price.version) } }))
  try { await db.batch(statements) } catch { return json({ error: 'Não foi possível alterar o status do preço' }, 409) }
  return json({ data: { id: priceId, status: action === 'activate' ? 'active' : 'retired', updatedAt: now } })
}
