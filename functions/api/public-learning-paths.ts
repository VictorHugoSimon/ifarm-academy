import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { boundedText, publicSlug, safePublicAssetRef } from './_publicDiscovery'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const VISIBILITIES = ['hidden','public']
const ACCESS_MODELS = ['not_configured','free','paid','sponsored','included']

function courseIdsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    const id = String(item ?? '').trim()
    if (id && !out.includes(id)) out.push(id)
    if (out.length >= 50) break
  }
  return out
}

async function validateCourses(db: any, tenantId: string, courseIds: string[], requirePublic: boolean) {
  for (const courseId of courseIds) {
    const row = await db.prepare(`
      SELECT c.id,c.status,p.visibility AS public_visibility
      FROM academy_courses c
      LEFT JOIN academy_course_public_profiles p ON p.tenant_id=c.tenant_id AND p.course_id=c.id
      WHERE c.tenant_id=? AND c.id=? LIMIT 1
    `).bind(tenantId, courseId).first()
    if (!row) return `Curso ${courseId} não pertence a este tenant`
    if (requirePublic && (String(row.status) !== 'published' || String(row.public_visibility ?? '') !== 'public')) {
      return `Curso ${courseId} precisa estar publicado academicamente e no portal`
    }
  }
  return null
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const paths = await db.prepare(`
    SELECT p.*,COUNT(pc.id) AS course_count
    FROM academy_public_learning_paths p
    LEFT JOIN academy_public_learning_path_courses pc ON pc.tenant_id=p.tenant_id AND pc.path_id=p.id
    WHERE p.tenant_id=?
    GROUP BY p.id
    ORDER BY p.featured DESC,p.title
  `).bind(auth.tenantId).all()

  const data = []
  for (const row of paths.results as any[]) {
    const courses = await db.prepare(`
      SELECT pc.course_id,pc.position,c.title,c.status,cp.visibility AS public_visibility
      FROM academy_public_learning_path_courses pc
      JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id
      LEFT JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id
      WHERE pc.tenant_id=? AND pc.path_id=? ORDER BY pc.position
    `).bind(auth.tenantId, row.id).all()
    data.push({
      id: row.id, slug: row.slug, title: row.title, shortDescription: row.short_description ?? null,
      description: row.description ?? '', category: row.category ?? null, coverRef: row.cover_ref ?? null,
      visibility: row.visibility, featured: Number(row.featured) === 1, accessModel: row.access_model,
      listPriceCents: row.list_price_cents == null ? null : Number(row.list_price_cents), currency: row.currency,
      seoTitle: row.seo_title ?? null, seoDescription: row.seo_description ?? null,
      courses: (courses.results as any[]).map((course) => ({ courseId: course.course_id, title: course.title, position: Number(course.position), academicStatus: course.status, publicVisibility: course.public_visibility ?? 'hidden' })),
      createdAt: row.created_at, updatedAt: row.updated_at,
    })
  }
  return json({ data })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const title = String(body.title ?? '').trim()
  const slug = publicSlug(body.slug)
  const visibility = String(body.visibility ?? 'hidden').trim()
  const accessModel = String(body.accessModel ?? 'not_configured').trim()
  const courseIds = courseIdsFrom(body.courseIds)
  const rawCoverRef = String(body.coverRef ?? '').trim()
  const coverRef = rawCoverRef ? safePublicAssetRef(rawCoverRef) : null
  const listPriceCents = body.listPriceCents == null || body.listPriceCents === '' ? null : Number(body.listPriceCents)
  if (!title || title.length > 160 || !slug) return json({ error: 'title e slug válido são obrigatórios' }, 400)
  if (!VISIBILITIES.includes(visibility) || !ACCESS_MODELS.includes(accessModel)) return json({ error: 'visibility/accessModel inválido' }, 400)
  if (rawCoverRef && !coverRef) return json({ error: 'coverRef deve ser HTTPS ou referência relativa segura' }, 400)
  if (accessModel === 'paid' && (!Number.isInteger(listPriceCents) || Number(listPriceCents) < 1)) return json({ error: 'Trilha paga exige listPriceCents maior que zero' }, 400)
  if (accessModel !== 'paid' && listPriceCents != null && Number(listPriceCents) > 0) return json({ error: 'Preço positivo só é permitido em trilha paga' }, 400)
  if (visibility === 'public' && !courseIds.length) return json({ error: 'Trilha pública exige ao menos um curso' }, 400)
  const courseError = await validateCourses(db, auth.tenantId, courseIds, visibility === 'public')
  if (courseError) return json({ error: courseError }, 409)

  const id = crypto.randomUUID(); const now = new Date().toISOString()
  try {
    await db.prepare(`INSERT INTO academy_public_learning_paths (
      id,tenant_id,slug,title,short_description,description,category,cover_ref,visibility,featured,access_model,list_price_cents,currency,seo_title,seo_description,created_by,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?, 'hidden',?,?,?,?,?,?,?,?,?)`).bind(
      id, auth.tenantId, slug, title, boundedText(body.shortDescription, 320), String(body.description ?? '').trim(), boundedText(body.category, 100), coverRef,
      body.featured === true ? 1 : 0, accessModel, listPriceCents, String(body.currency ?? 'BRL').trim().toUpperCase() || 'BRL', boundedText(body.seoTitle, 160), boundedText(body.seoDescription, 320), auth.userId, now, now,
    ).run()
    for (let position = 0; position < courseIds.length; position += 1) {
      await db.prepare(`INSERT INTO academy_public_learning_path_courses (id,tenant_id,path_id,course_id,position,created_at) VALUES (?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(), auth.tenantId, id, courseIds[position], position, now).run()
    }
    if (visibility === 'public') await db.prepare("UPDATE academy_public_learning_paths SET visibility='public',updated_at=? WHERE tenant_id=? AND id=?").bind(now, auth.tenantId, id).run()
    await auditStatement(db, auth, { action: 'public_learning_path.created', resourceType: 'public_learning_path', resourceId: id, metadata: { slug, visibility, courseCount: courseIds.length, accessModel } }).run()
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Não foi possível criar a trilha pública' }, 409)
  }
  return json({ data: { id, slug, title, visibility, accessModel, courseIds, updatedAt: now } }, 201)
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const pathId = String(body.pathId ?? '').trim()
  if (!pathId) return json({ error: 'pathId é obrigatório' }, 400)
  const existing = await db.prepare('SELECT * FROM academy_public_learning_paths WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId, pathId).first()
  if (!existing) return json({ error: 'Trilha pública não encontrada neste tenant' }, 404)

  const title = String(body.title ?? existing.title).trim()
  const slug = publicSlug(body.slug ?? existing.slug)
  const visibility = String(body.visibility ?? existing.visibility).trim()
  const accessModel = String(body.accessModel ?? existing.access_model).trim()
  const currentCourses = await db.prepare('SELECT course_id FROM academy_public_learning_path_courses WHERE tenant_id=? AND path_id=? ORDER BY position').bind(auth.tenantId, pathId).all()
  const courseIds = body.courseIds === undefined ? (currentCourses.results as any[]).map((row) => String(row.course_id)) : courseIdsFrom(body.courseIds)
  const rawCoverRef = String(body.coverRef ?? existing.cover_ref ?? '').trim()
  const coverRef = rawCoverRef ? safePublicAssetRef(rawCoverRef) : null
  const rawPrice = body.listPriceCents === undefined ? existing.list_price_cents : body.listPriceCents
  const listPriceCents = rawPrice == null || rawPrice === '' ? null : Number(rawPrice)
  if (!title || title.length > 160 || !slug) return json({ error: 'title/slug inválido' }, 400)
  if (!VISIBILITIES.includes(visibility) || !ACCESS_MODELS.includes(accessModel)) return json({ error: 'visibility/accessModel inválido' }, 400)
  if (rawCoverRef && !coverRef) return json({ error: 'coverRef inválido' }, 400)
  if (accessModel === 'paid' && (!Number.isInteger(listPriceCents) || Number(listPriceCents) < 1)) return json({ error: 'Trilha paga exige preço válido' }, 400)
  if (accessModel !== 'paid' && listPriceCents != null && Number(listPriceCents) > 0) return json({ error: 'Preço positivo só é permitido em trilha paga' }, 400)
  if (visibility === 'public' && !courseIds.length) return json({ error: 'Trilha pública exige ao menos um curso' }, 400)
  const courseError = await validateCourses(db, auth.tenantId, courseIds, visibility === 'public')
  if (courseError) return json({ error: courseError }, 409)
  const now = new Date().toISOString()

  try {
    await db.prepare("UPDATE academy_public_learning_paths SET visibility='hidden',updated_at=? WHERE tenant_id=? AND id=?").bind(now, auth.tenantId, pathId).run()
    await db.prepare('DELETE FROM academy_public_learning_path_courses WHERE tenant_id=? AND path_id=?').bind(auth.tenantId, pathId).run()
    for (let position = 0; position < courseIds.length; position += 1) {
      await db.prepare('INSERT INTO academy_public_learning_path_courses (id,tenant_id,path_id,course_id,position,created_at) VALUES (?,?,?,?,?,?)')
        .bind(crypto.randomUUID(), auth.tenantId, pathId, courseIds[position], position, now).run()
    }
    await db.prepare(`UPDATE academy_public_learning_paths SET slug=?,title=?,short_description=?,description=?,category=?,cover_ref=?,featured=?,access_model=?,list_price_cents=?,currency=?,seo_title=?,seo_description=?,visibility=?,updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(slug, title, boundedText(body.shortDescription ?? existing.short_description, 320), String(body.description ?? existing.description ?? '').trim(), boundedText(body.category ?? existing.category, 100), coverRef, body.featured === undefined ? Number(existing.featured) : body.featured === true ? 1 : 0, accessModel, listPriceCents, String(body.currency ?? existing.currency ?? 'BRL').trim().toUpperCase() || 'BRL', boundedText(body.seoTitle ?? existing.seo_title, 160), boundedText(body.seoDescription ?? existing.seo_description, 320), visibility, now, auth.tenantId, pathId).run()
    await auditStatement(db, auth, { action: 'public_learning_path.updated', resourceType: 'public_learning_path', resourceId: pathId, metadata: { slug, visibility, courseCount: courseIds.length, accessModel } }).run()
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar a trilha pública' }, 409)
  }
  return json({ data: { id: pathId, slug, title, visibility, accessModel, courseIds, updatedAt: now } })
}
