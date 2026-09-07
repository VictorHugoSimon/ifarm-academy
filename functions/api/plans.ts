import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { normalizeExternalBenefits, planAudience, planCommercialMode, planSlug, validatePlanCommercialShape } from './_plans'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin','ifarm_admin']
const PLAN_STATUSES = new Set(['draft','public','archived'])

function optionalText(value: unknown, max: number): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (text.length > max) throw new Error(`Texto excede ${max} caracteres`)
  return text
}

async function planSnapshot(db: any, tenantId: string) {
  const [plans, prices, courses, paths, benefits] = await Promise.all([
    db.prepare('SELECT * FROM academy_plans WHERE tenant_id=? ORDER BY status="archived", featured DESC, name').bind(tenantId).all(),
    db.prepare('SELECT * FROM academy_plan_prices WHERE tenant_id=? ORDER BY plan_id,billing_interval,version DESC').bind(tenantId).all(),
    db.prepare(`SELECT pc.plan_id,pc.course_id,c.title,cp.visibility AS public_visibility
      FROM academy_plan_courses pc
      JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id
      LEFT JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id
      WHERE pc.tenant_id=? ORDER BY c.title`).bind(tenantId).all(),
    db.prepare(`SELECT pp.plan_id,pp.path_id,p.title,p.visibility
      FROM academy_plan_paths pp
      JOIN academy_public_learning_paths p ON p.tenant_id=pp.tenant_id AND p.id=pp.path_id
      WHERE pp.tenant_id=? ORDER BY p.title`).bind(tenantId).all(),
    db.prepare('SELECT * FROM academy_plan_external_benefits WHERE tenant_id=? ORDER BY plan_id,source_system,label').bind(tenantId).all(),
  ])
  const priceRows = prices.results as any[]
  const courseRows = courses.results as any[]
  const pathRows = paths.results as any[]
  const benefitRows = benefits.results as any[]
  return (plans.results as any[]).map((row) => ({
    id: row.id, slug: row.slug, name: row.name, description: row.description ?? '',
    audienceType: row.audience_type, commercialMode: row.commercial_mode, status: row.status,
    featured: Number(row.featured) === 1, maxUsers: row.max_users == null ? null : Number(row.max_users),
    seoTitle: row.seo_title ?? null, seoDescription: row.seo_description ?? null,
    createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
    prices: priceRows.filter((price) => price.plan_id === row.id).map((price) => ({
      id: price.id, billingInterval: price.billing_interval, priceUnit: price.price_unit,
      version: Number(price.version), amountCents: Number(price.amount_cents), currency: price.currency,
      status: price.status, validFrom: price.valid_from ?? null, validUntil: price.valid_until ?? null,
      createdBy: price.created_by, createdAt: price.created_at, updatedAt: price.updated_at,
    })),
    courses: courseRows.filter((item) => item.plan_id === row.id).map((item) => ({ courseId: item.course_id, title: item.title, publicVisibility: item.public_visibility ?? 'hidden' })),
    paths: pathRows.filter((item) => item.plan_id === row.id).map((item) => ({ pathId: item.path_id, title: item.title, visibility: item.visibility })),
    externalBenefits: benefitRows.filter((item) => item.plan_id === row.id).map((item) => ({ id: item.id, sourceSystem: item.source_system, externalRef: item.external_ref, label: item.label, description: item.description ?? '' })),
  }))
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  return json({ data: await planSnapshot(db, auth.tenantId) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const slug = planSlug(body.slug)
  const name = String(body.name ?? '').trim()
  const audienceType = planAudience(body.audienceType)
  const commercialMode = planCommercialMode(body.commercialMode)
  const maxUsers = body.maxUsers == null || body.maxUsers === '' ? null : Number(body.maxUsers)
  if (!slug || !name || name.length > 160) return json({ error: 'slug ou nome inválido' }, 400)
  if (!audienceType || !commercialMode) return json({ error: 'audienceType ou commercialMode inválido' }, 400)
  const shapeError = validatePlanCommercialShape({ audienceType, commercialMode, maxUsers })
  if (shapeError) return json({ error: shapeError }, 400)
  let description = ''
  let seoTitle: string | null = null
  let seoDescription: string | null = null
  try {
    description = optionalText(body.description, 2000) ?? ''
    seoTitle = optionalText(body.seoTitle, 160)
    seoDescription = optionalText(body.seoDescription, 320)
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Metadados inválidos' }, 400) }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  try {
    await db.batch([
      db.prepare(`INSERT INTO academy_plans
        (id,tenant_id,slug,name,description,audience_type,commercial_mode,status,featured,max_users,seo_title,seo_description,created_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,'draft',?,?,?,?,?,?,?)`)
        .bind(id, auth.tenantId, slug, name, description, audienceType, commercialMode, body.featured === true ? 1 : 0, maxUsers, seoTitle, seoDescription, auth.userId, now, now),
      auditStatement(db, auth, { action: 'plan.created', resourceType: 'plan', resourceId: id, metadata: { slug, audienceType, commercialMode } }),
    ])
  } catch { return json({ error: 'Slug já utilizado ou plano inválido' }, 409) }
  return json({ data: { id, slug, name, audienceType, commercialMode, status: 'draft', createdAt: now } }, 201)
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const planId = String(body.planId ?? '').trim()
  if (!planId) return json({ error: 'planId é obrigatório' }, 400)
  const existing = await db.prepare('SELECT * FROM academy_plans WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId, planId).first()
  if (!existing) return json({ error: 'Plano não encontrado neste tenant' }, 404)

  const slug = planSlug(body.slug ?? existing.slug)
  const name = String(body.name ?? existing.name).trim()
  const audienceType = planAudience(body.audienceType ?? existing.audience_type)
  const commercialMode = planCommercialMode(body.commercialMode ?? existing.commercial_mode)
  const targetStatus = String(body.status ?? existing.status).trim()
  const maxUsers = body.maxUsers === undefined ? (existing.max_users == null ? null : Number(existing.max_users)) : body.maxUsers == null || body.maxUsers === '' ? null : Number(body.maxUsers)
  if (!slug || !name || name.length > 160 || !audienceType || !commercialMode || !PLAN_STATUSES.has(targetStatus)) return json({ error: 'Dados do plano inválidos' }, 400)
  const shapeError = validatePlanCommercialShape({ audienceType, commercialMode, maxUsers })
  if (shapeError) return json({ error: shapeError }, 400)

  let description: string
  let seoTitle: string | null
  let seoDescription: string | null
  try {
    description = optionalText(body.description ?? existing.description, 2000) ?? ''
    seoTitle = optionalText(body.seoTitle ?? existing.seo_title, 160)
    seoDescription = optionalText(body.seoDescription ?? existing.seo_description, 320)
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Metadados inválidos' }, 400) }

  const courseIds = Array.isArray(body.courseIds) ? [...new Set(body.courseIds.map((id) => String(id).trim()).filter(Boolean))].slice(0, 200) : null
  const pathIds = Array.isArray(body.pathIds) ? [...new Set(body.pathIds.map((id) => String(id).trim()).filter(Boolean))].slice(0, 100) : null
  const benefits = body.externalBenefits === undefined ? null : normalizeExternalBenefits(body.externalBenefits)

  if (commercialMode !== 'priced') {
    const nonRetired = await db.prepare("SELECT COUNT(*) AS n FROM academy_plan_prices WHERE tenant_id=? AND plan_id=? AND status!='retired'").bind(auth.tenantId, planId).first()
    if (Number(nonRetired?.n ?? 0) > 0) return json({ error: 'Aposente os preços ativos/draft antes de mudar para free/contact_sales' }, 409)
  }

  if (courseIds) {
    for (const courseId of courseIds) {
      const course = await db.prepare('SELECT id,status FROM academy_courses WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId, courseId).first()
      if (!course) return json({ error: `Curso ${courseId} não pertence a este tenant` }, 404)
      if (targetStatus === 'public') {
        const profile = await db.prepare("SELECT course_id FROM academy_course_public_profiles WHERE tenant_id=? AND course_id=? AND visibility='public' LIMIT 1").bind(auth.tenantId, courseId).first()
        if (String(course.status) !== 'published' || !profile) return json({ error: 'Plano público aceita somente cursos academicamente/publicamente publicados' }, 409)
      }
    }
  }
  if (pathIds) {
    for (const pathId of pathIds) {
      const path = await db.prepare('SELECT id,visibility FROM academy_public_learning_paths WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId, pathId).first()
      if (!path) return json({ error: `Trilha ${pathId} não pertence a este tenant` }, 404)
      if (targetStatus === 'public' && String(path.visibility) !== 'public') return json({ error: 'Plano público aceita somente trilhas públicas' }, 409)
    }
  }

  const now = new Date().toISOString()
  const statements: any[] = [
    db.prepare(`UPDATE academy_plans SET slug=?,name=?,description=?,audience_type=?,commercial_mode=?,status='draft',featured=?,max_users=?,seo_title=?,seo_description=?,updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(slug, name, description, audienceType, commercialMode, body.featured === undefined ? Number(existing.featured) : body.featured === true ? 1 : 0, maxUsers, seoTitle, seoDescription, now, auth.tenantId, planId),
  ]
  if (courseIds) {
    statements.push(db.prepare('DELETE FROM academy_plan_courses WHERE tenant_id=? AND plan_id=?').bind(auth.tenantId, planId))
    for (const courseId of courseIds) statements.push(db.prepare('INSERT INTO academy_plan_courses (id,tenant_id,plan_id,course_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), auth.tenantId, planId, courseId, now))
  }
  if (pathIds) {
    statements.push(db.prepare('DELETE FROM academy_plan_paths WHERE tenant_id=? AND plan_id=?').bind(auth.tenantId, planId))
    for (const pathId of pathIds) statements.push(db.prepare('INSERT INTO academy_plan_paths (id,tenant_id,plan_id,path_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), auth.tenantId, planId, pathId, now))
  }
  if (benefits) {
    statements.push(db.prepare('DELETE FROM academy_plan_external_benefits WHERE tenant_id=? AND plan_id=?').bind(auth.tenantId, planId))
    for (const benefit of benefits) statements.push(db.prepare(`INSERT INTO academy_plan_external_benefits (id,tenant_id,plan_id,source_system,external_ref,label,description,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), auth.tenantId, planId, benefit.sourceSystem, benefit.externalRef, benefit.label, benefit.description, now))
  }
  statements.push(auditStatement(db, auth, { action: 'plan.updated', resourceType: 'plan', resourceId: planId, metadata: { slug, audienceType, commercialMode, requestedStatus: targetStatus } }))

  try { await db.batch(statements) } catch { return json({ error: 'Não foi possível atualizar o plano; ele permaneceu em estado seguro' }, 409) }

  if (targetStatus !== 'draft') {
    try {
      await db.batch([
        db.prepare('UPDATE academy_plans SET status=?,updated_at=? WHERE tenant_id=? AND id=?').bind(targetStatus, now, auth.tenantId, planId),
        auditStatement(db, auth, { action: `plan.${targetStatus === 'public' ? 'published' : 'archived'}`, resourceType: 'plan', resourceId: planId, metadata: { slug } }),
      ])
    } catch { return json({ error: 'Configuração salva como draft, mas os requisitos de publicação não foram atendidos', data: { id: planId, status: 'draft' } }, 409) }
  }

  const data = await planSnapshot(db, auth.tenantId)
  return json({ data: data.find((item) => item.id === planId) ?? null })
}
