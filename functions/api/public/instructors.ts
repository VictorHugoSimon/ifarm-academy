import { resolvePublicTenant } from '../_publicTenant'
import { dbOr503, json, safeJson, type Env } from '../_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)

  const rows = await db.prepare(`
    SELECT p.*,i.display_name_snapshot,
      (SELECT COUNT(DISTINCT r.course_id)
       FROM academy_course_instructor_roles r
       JOIN academy_courses c ON c.tenant_id=r.tenant_id AND c.id=r.course_id AND c.status='published'
       JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id AND cp.visibility='public'
       LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
       LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
       WHERE r.tenant_id=p.tenant_id AND r.instructor_id=p.instructor_id AND r.status='active'
         AND r.role IN ('author','instructor')
         AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
      ) AS public_course_count
    FROM academy_instructor_public_profiles p
    JOIN academy_instructors i ON i.id=p.instructor_id AND i.tenant_id=p.tenant_id AND i.status='active'
    WHERE p.tenant_id=? AND p.visibility='public'
    ORDER BY p.featured DESC,i.display_name_snapshot
  `).bind(context.tenantId).all()

  return json({ brand: context.brand, data: (rows.results as any[]).map((row) => ({
    instructorId: row.instructor_id,
    slug: row.slug,
    displayName: row.display_name_snapshot,
    headline: row.headline ?? null,
    shortBio: row.short_bio ?? null,
    photoRef: row.photo_ref ?? null,
    specialties: safeJson(row.public_specialties_json, []),
    credentialSummary: row.credential_summary ?? null,
    featured: Number(row.featured) === 1,
    publicCourseCount: Number(row.public_course_count ?? 0),
  })) })
}
