import { resolvePublicTenant } from '../_publicTenant'
import { dbOr503, json, type Env } from '../_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)

  const rows = await db.prepare(`
    SELECT p.*,
      COUNT(DISTINCT CASE WHEN c.id IS NOT NULL AND cp.course_id IS NOT NULL
        AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
        THEN pc.course_id END) AS visible_course_count,
      COALESCE(SUM(CASE WHEN c.id IS NOT NULL AND cp.course_id IS NOT NULL
        AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
        THEN (SELECT COALESCE(SUM(l.duration_minutes),0) FROM academy_course_lessons l WHERE l.tenant_id=c.tenant_id AND l.course_id=c.id)
        ELSE 0 END),0) AS workload_minutes
    FROM academy_public_learning_paths p
    JOIN academy_public_learning_path_courses pc ON pc.tenant_id=p.tenant_id AND pc.path_id=p.id
    LEFT JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id AND c.status='published'
    LEFT JOIN academy_course_public_profiles cp ON cp.tenant_id=pc.tenant_id AND cp.course_id=pc.course_id AND cp.visibility='public'
    LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=p.tenant_id AND ws.status='active'
    LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=p.tenant_id AND wc.course_id=pc.course_id AND wc.visible=1
    WHERE p.tenant_id=? AND p.visibility='public'
    GROUP BY p.id
    HAVING visible_course_count > 0
    ORDER BY p.featured DESC,p.title
  `).bind(context.tenantId).all()

  return json({ brand: context.brand, data: (rows.results as any[]).map((row) => ({
    id: row.id, slug: row.slug, title: row.title, shortDescription: row.short_description ?? null,
    description: row.description ?? '', category: row.category ?? null, coverRef: row.cover_ref ?? null,
    featured: Number(row.featured) === 1, accessModel: row.access_model,
    listPriceCents: row.list_price_cents == null ? null : Number(row.list_price_cents), currency: row.currency,
    courseCount: Number(row.visible_course_count ?? 0), workloadMinutes: Number(row.workload_minutes ?? 0), checkoutReady: false,
  })) })
}
