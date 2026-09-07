import { resolvePublicTenant } from '../_publicTenant'
import { dbOr503, json, type Env } from '../_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)

  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const category = url.searchParams.get('category')?.trim() ?? ''

  const result = await db.prepare(`
    SELECT c.id,c.title,c.description,c.instructor_label,c.certificate_type,
      p.slug,p.category,p.level_label,p.short_description,p.audience_text,p.cover_ref,
      p.access_model,p.list_price_cents,p.currency,p.featured,p.updated_at,
      COALESCE(SUM(l.duration_minutes),0) AS workload_minutes,
      COUNT(DISTINCT m.id) AS module_count,
      COUNT(DISTINCT l.id) AS lesson_count,
      COALESCE(wc.featured,0) AS white_label_featured
    FROM academy_course_public_profiles p
    JOIN academy_courses c ON c.id=p.course_id AND c.tenant_id=p.tenant_id AND c.status='published'
    LEFT JOIN academy_course_modules m ON m.tenant_id=c.tenant_id AND m.course_id=c.id
    LEFT JOIN academy_course_lessons l ON l.tenant_id=c.tenant_id AND l.course_id=c.id
    LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
    LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
    WHERE p.tenant_id=? AND p.visibility='public'
      AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
      AND (?='' OR LOWER(c.title) LIKE '%' || ? || '%' OR LOWER(COALESCE(p.short_description,'')) LIKE '%' || ? || '%')
      AND (?='' OR COALESCE(p.category,'')=?)
    GROUP BY c.id,p.course_id
    ORDER BY CASE WHEN (p.featured=1 OR COALESCE(wc.featured,0)=1) THEN 0 ELSE 1 END, c.title
  `).bind(context.tenantId, query, query, query, category, category).all()

  const categories = await db.prepare(`
    SELECT DISTINCT p.category
    FROM academy_course_public_profiles p
    JOIN academy_courses c ON c.id=p.course_id AND c.tenant_id=p.tenant_id AND c.status='published'
    LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
    LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
    WHERE p.tenant_id=? AND p.visibility='public' AND p.category IS NOT NULL AND p.category!=''
      AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
    ORDER BY p.category
  `).bind(context.tenantId).all()

  return json({
    brand: context.brand,
    data: (result.results as any[]).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.short_description || row.description || '',
      category: row.category ?? null,
      levelLabel: row.level_label ?? null,
      audienceText: row.audience_text ?? null,
      coverRef: row.cover_ref ?? null,
      instructorLabel: row.instructor_label ?? null,
      certificateType: row.certificate_type ?? 'free_course',
      accessModel: row.access_model,
      listPriceCents: row.list_price_cents == null ? null : Number(row.list_price_cents),
      currency: row.currency,
      featured: Number(row.featured) === 1 || Number(row.white_label_featured) === 1,
      workloadMinutes: Number(row.workload_minutes ?? 0),
      moduleCount: Number(row.module_count ?? 0),
      lessonCount: Number(row.lesson_count ?? 0),
      checkoutReady: false,
    })),
    filters: { categories: (categories.results as any[]).map((row) => String(row.category)) },
  })
}
