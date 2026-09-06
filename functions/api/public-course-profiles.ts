import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { publicCourseSlug } from './_publicTenant'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin','ifarm_admin']
const ACCESS_MODELS = new Set(['not_configured','free','paid','sponsored','included'])

function optionalText(value: unknown, max: number): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (text.length > max) throw new Error(`Texto excede ${max} caracteres`)
  return text
}

function safeCoverRef(value: unknown): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (text.length > 500) throw new Error('coverRef muito longo')
  if (!(text.startsWith('https://') || (text.startsWith('/') && !text.startsWith('//')))) {
    throw new Error('coverRef deve usar HTTPS ou referência relativa da Academy')
  }
  return text
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const result = await db.prepare(`
    SELECT c.id,c.title,c.description,c.status,
      p.slug,p.category,p.level_label,p.short_description,p.audience_text,p.cover_ref,
      p.visibility,p.access_model,p.list_price_cents,p.currency,p.featured,p.seo_title,p.seo_description,p.updated_at
    FROM academy_courses c
    LEFT JOIN academy_course_public_profiles p ON p.tenant_id=c.tenant_id AND p.course_id=c.id
    WHERE c.tenant_id=?
    ORDER BY c.title
  `).bind(auth.tenantId).all()
  return json({ data: (result.results as any[]).map((row) => ({
    courseId: row.id,
    courseTitle: row.title,
    courseStatus: row.status,
    courseDescription: row.description ?? '',
    configured: Boolean(row.slug),
    slug: row.slug ?? null,
    category: row.category ?? null,
    levelLabel: row.level_label ?? null,
    shortDescription: row.short_description ?? null,
    audienceText: row.audience_text ?? null,
    coverRef: row.cover_ref ?? null,
    visibility: row.visibility ?? 'hidden',
    accessModel: row.access_model ?? 'not_configured',
    listPriceCents: row.list_price_cents == null ? null : Number(row.list_price_cents),
    currency: row.currency ?? 'BRL',
    featured: Number(row.featured ?? 0) === 1,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    updatedAt: row.updated_at ?? null,
  })) })
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const courseId = String(body.courseId ?? '').trim()
  const slug = publicCourseSlug(body.slug)
  const visibility = body.visibility === 'public' ? 'public' : 'hidden'
  const accessModel = String(body.accessModel ?? 'not_configured').trim()
  const priceRaw = body.listPriceCents == null || body.listPriceCents === '' ? null : Number(body.listPriceCents)
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)
  if (!slug) return json({ error: 'slug inválido' }, 400)
  if (!ACCESS_MODELS.has(accessModel)) return json({ error: 'accessModel inválido' }, 400)
  if (priceRaw != null && (!Number.isInteger(priceRaw) || priceRaw < 0)) return json({ error: 'listPriceCents inválido' }, 400)
  if (accessModel === 'paid' && (!priceRaw || priceRaw < 1)) return json({ error: 'Curso pago exige preço maior que zero' }, 400)
  if (accessModel !== 'paid' && priceRaw != null && priceRaw > 0) return json({ error: 'Preço só pode ser informado para curso pago' }, 400)

  let category: string | null
  let levelLabel: string | null
  let shortDescription: string | null
  let audienceText: string | null
  let coverRef: string | null
  let seoTitle: string | null
  let seoDescription: string | null
  try {
    category = optionalText(body.category, 80)
    levelLabel = optionalText(body.levelLabel, 80)
    shortDescription = optionalText(body.shortDescription, 280)
    audienceText = optionalText(body.audienceText, 500)
    coverRef = safeCoverRef(body.coverRef)
    seoTitle = optionalText(body.seoTitle, 120)
    seoDescription = optionalText(body.seoDescription, 220)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Metadados inválidos' }, 400)
  }

  const course = await db.prepare('SELECT id,title,status FROM academy_courses WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, courseId).first()
  if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  if (visibility === 'public' && String(course.status) !== 'published') {
    return json({ error: 'Somente curso academicamente publicado pode ficar visível no portal' }, 409)
  }

  const now = new Date().toISOString()
  try {
    await db.batch([
      db.prepare(`
        INSERT INTO academy_course_public_profiles (
          course_id,tenant_id,slug,category,level_label,short_description,audience_text,cover_ref,
          visibility,access_model,list_price_cents,currency,featured,seo_title,seo_description,
          updated_by,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(course_id) DO UPDATE SET
          slug=excluded.slug,category=excluded.category,level_label=excluded.level_label,
          short_description=excluded.short_description,audience_text=excluded.audience_text,
          cover_ref=excluded.cover_ref,visibility=excluded.visibility,access_model=excluded.access_model,
          list_price_cents=excluded.list_price_cents,currency=excluded.currency,featured=excluded.featured,
          seo_title=excluded.seo_title,seo_description=excluded.seo_description,
          updated_by=excluded.updated_by,updated_at=excluded.updated_at
      `).bind(
        courseId, auth.tenantId, slug, category, levelLabel, shortDescription, audienceText, coverRef,
        visibility, accessModel, priceRaw, 'BRL', body.featured === true ? 1 : 0,
        seoTitle, seoDescription, auth.userId, now, now,
      ),
      auditStatement(db, auth, {
        action: 'public_portal.course_profile_updated', resourceType: 'course', resourceId: courseId,
        metadata: { slug, visibility, accessModel, featured: body.featured === true },
      }),
    ])
  } catch {
    return json({ error: 'Slug já utilizado ou configuração pública inválida' }, 409)
  }

  return json({ data: { courseId, slug, visibility, accessModel, listPriceCents: priceRaw, featured: body.featured === true, updatedAt: now } })
}
