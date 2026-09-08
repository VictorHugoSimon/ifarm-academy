import { normalizeSearchLimit, normalizeSearchQuery, normalizeSearchType, publicSearchScore, type PublicSearchType } from '../_publicAdvanced'
import { resolvePublicTenant } from '../_publicTenant'
import { dbOr503, json, type Env } from '../_shared'

type SearchItem = {
  type: PublicSearchType
  slug: string
  title: string
  description: string
  category?: string | null
  featured: boolean
  href: string
  score: number
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)

  const url = new URL(request.url)
  const q = normalizeSearchQuery(url.searchParams.get('q'))
  const type = normalizeSearchType(url.searchParams.get('type'))
  const limit = normalizeSearchLimit(url.searchParams.get('limit'))
  if (q.length > 0 && q.length < 2) return json({ error: 'Informe ao menos 2 caracteres para buscar' }, 400)

  const items: SearchItem[] = []
  const accepts = (candidate: PublicSearchType) => !type || type === candidate

  if (accepts('course')) {
    const rows = await db.prepare(`
      SELECT c.title,p.slug,p.short_description,p.category,p.featured,COALESCE(wc.featured,0) white_label_featured
      FROM academy_course_public_profiles p
      JOIN academy_courses c ON c.id=p.course_id AND c.tenant_id=p.tenant_id AND c.status='published'
      LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=p.tenant_id AND ws.status='active'
      LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=p.tenant_id AND wc.course_id=p.course_id AND wc.visible=1
      WHERE p.tenant_id=? AND p.visibility='public'
        AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
    `).bind(context.tenantId).all()
    for (const row of rows.results as any[]) {
      const score = publicSearchScore(q, String(row.title), String(row.short_description ?? ''), String(row.category ?? ''))
      if (!q || score > 0) items.push({ type:'course', slug:String(row.slug), title:String(row.title), description:String(row.short_description ?? ''), category:row.category ?? null, featured:Number(row.featured)===1 || Number(row.white_label_featured)===1, href:`/courses/${row.slug}`, score })
    }
  }

  if (accepts('path')) {
    const rows = await db.prepare(`
      SELECT p.id,p.slug,p.title,p.short_description,p.category,p.featured,
        COUNT(DISTINCT CASE WHEN c.id IS NOT NULL AND cp.course_id IS NOT NULL
          AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
          THEN pc.course_id END) visible_course_count
      FROM academy_public_learning_paths p
      JOIN academy_public_learning_path_courses pc ON pc.tenant_id=p.tenant_id AND pc.path_id=p.id
      LEFT JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id AND c.status='published'
      LEFT JOIN academy_course_public_profiles cp ON cp.tenant_id=pc.tenant_id AND cp.course_id=pc.course_id AND cp.visibility='public'
      LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=p.tenant_id AND ws.status='active'
      LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=p.tenant_id AND wc.course_id=pc.course_id AND wc.visible=1
      WHERE p.tenant_id=? AND p.visibility='public'
      GROUP BY p.id HAVING visible_course_count>0
    `).bind(context.tenantId).all()
    for (const row of rows.results as any[]) {
      const score = publicSearchScore(q, String(row.title), String(row.short_description ?? ''), String(row.category ?? ''))
      if (!q || score > 0) items.push({ type:'path', slug:String(row.slug), title:String(row.title), description:String(row.short_description ?? ''), category:row.category ?? null, featured:Number(row.featured)===1, href:`/paths/${row.slug}`, score })
    }
  }

  if (accepts('instructor')) {
    const rows = await db.prepare(`
      SELECT p.slug,i.display_name,p.headline,p.short_bio,p.featured
      FROM academy_instructor_public_profiles p
      JOIN academy_instructors i ON i.id=p.instructor_id AND i.tenant_id=p.tenant_id AND i.status='active'
      WHERE p.tenant_id=? AND p.visibility='public'
    `).bind(context.tenantId).all()
    for (const row of rows.results as any[]) {
      const description = String(row.headline ?? row.short_bio ?? '')
      const score = publicSearchScore(q, String(row.display_name), description)
      if (!q || score > 0) items.push({ type:'instructor', slug:String(row.slug), title:String(row.display_name), description, featured:Number(row.featured)===1, href:`/instructors/${row.slug}`, score })
    }
  }

  if (accepts('plan')) {
    const rows = await db.prepare(`SELECT slug,name,description,audience_type,featured FROM academy_plans WHERE tenant_id=? AND status='public'`).bind(context.tenantId).all()
    for (const row of rows.results as any[]) {
      const score = publicSearchScore(q, String(row.name), String(row.description ?? ''), String(row.audience_type ?? ''))
      if (!q || score > 0) items.push({ type:'plan', slug:String(row.slug), title:String(row.name), description:String(row.description ?? ''), category:row.audience_type ?? null, featured:Number(row.featured)===1, href:`/plans/${row.slug}`, score })
    }
  }

  if (accepts('partner')) {
    const rows = await db.prepare(`SELECT slug,display_name,short_description,description,featured FROM academy_public_partner_profiles WHERE tenant_id=? AND visibility='public'`).bind(context.tenantId).all()
    for (const row of rows.results as any[]) {
      const description = String(row.short_description ?? row.description ?? '')
      const score = publicSearchScore(q, String(row.display_name), description)
      if (!q || score > 0) items.push({ type:'partner', slug:String(row.slug), title:String(row.display_name), description, featured:Number(row.featured)===1, href:`/partners/${row.slug}`, score })
    }
  }

  if (accepts('bundle')) {
    const rows = await db.prepare(`SELECT slug,title,short_description,description,category,featured FROM academy_public_bundles WHERE tenant_id=? AND visibility='public'`).bind(context.tenantId).all()
    for (const row of rows.results as any[]) {
      const description = String(row.short_description ?? row.description ?? '')
      const score = publicSearchScore(q, String(row.title), description, String(row.category ?? ''))
      if (!q || score > 0) items.push({ type:'bundle', slug:String(row.slug), title:String(row.title), description, category:row.category ?? null, featured:Number(row.featured)===1, href:`/bundles/${row.slug}`, score })
    }
  }

  items.sort((a,b) => (b.score-a.score) || (Number(b.featured)-Number(a.featured)) || a.title.localeCompare(b.title,'pt-BR'))
  return json({ brand: context.brand, query: q, data: items.slice(0, limit), filters: { types: ['course','path','instructor','plan','partner','bundle'] } })
}
