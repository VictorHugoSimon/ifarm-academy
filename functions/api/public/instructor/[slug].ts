import { publicCourseSlug, resolvePublicTenant } from '../../_publicTenant'
import { dbOr503, json, safeJson, type Env } from '../../_shared'

export const onRequestGet = async ({ env, request, params }: { env: Env; request: Request; params: Record<string,string> }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)
  const slug = publicCourseSlug(params.slug)
  if (!slug) return json({ error: 'Instrutor não encontrado' }, 404)

  const profile = await db.prepare(`
    SELECT p.*,i.display_name_snapshot
    FROM academy_instructor_public_profiles p
    JOIN academy_instructors i ON i.id=p.instructor_id AND i.tenant_id=p.tenant_id AND i.status='active'
    WHERE p.tenant_id=? AND p.slug=? AND p.visibility='public' LIMIT 1
  `).bind(context.tenantId, slug).first()
  if (!profile) return json({ error: 'Instrutor não encontrado' }, 404)

  const courses = await db.prepare(`
    SELECT DISTINCT c.id,c.title,c.description,c.instructor_label,c.certificate_type,
      cp.slug,cp.category,cp.level_label,cp.short_description,cp.audience_text,cp.cover_ref,
      cp.access_model,cp.list_price_cents,cp.currency,cp.featured,
      COALESCE((SELECT SUM(l.duration_minutes) FROM academy_course_lessons l WHERE l.tenant_id=c.tenant_id AND l.course_id=c.id),0) AS workload_minutes,
      (SELECT COUNT(*) FROM academy_course_lessons l WHERE l.tenant_id=c.tenant_id AND l.course_id=c.id) AS lesson_count,
      (SELECT COUNT(*) FROM academy_course_modules m WHERE m.tenant_id=c.tenant_id AND m.course_id=c.id) AS module_count
    FROM academy_course_instructor_roles r
    JOIN academy_courses c ON c.tenant_id=r.tenant_id AND c.id=r.course_id AND c.status='published'
    JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id AND cp.visibility='public'
    LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
    LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
    WHERE r.tenant_id=? AND r.instructor_id=? AND r.status='active' AND r.role IN ('author','instructor')
      AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
    ORDER BY cp.featured DESC,c.title
  `).bind(context.tenantId, profile.instructor_id).all()

  return json({ brand: context.brand, data: {
    instructorId: profile.instructor_id,
    slug: profile.slug,
    displayName: profile.display_name_snapshot,
    headline: profile.headline ?? null,
    shortBio: profile.short_bio ?? null,
    photoRef: profile.photo_ref ?? null,
    specialties: safeJson(profile.public_specialties_json, []),
    credentialSummary: profile.credential_summary ?? null,
    seoTitle: profile.seo_title ?? null,
    seoDescription: profile.seo_description ?? null,
    courses: (courses.results as any[]).map((row) => ({
      id: row.id, slug: row.slug, title: row.title, description: row.short_description || row.description || '',
      category: row.category ?? null, levelLabel: row.level_label ?? null, audienceText: row.audience_text ?? null,
      coverRef: row.cover_ref ?? null, instructorLabel: row.instructor_label ?? null, certificateType: row.certificate_type ?? 'free_course',
      accessModel: row.access_model, listPriceCents: row.list_price_cents == null ? null : Number(row.list_price_cents), currency: row.currency,
      featured: Number(row.featured) === 1, workloadMinutes: Number(row.workload_minutes ?? 0), lessonCount: Number(row.lesson_count ?? 0),
      moduleCount: Number(row.module_count ?? 0), checkoutReady: false,
    })),
  } })
}
