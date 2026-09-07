import { publicCourseSlug, resolvePublicTenant } from '../../_publicTenant'
import { dbOr503, json, type Env } from '../../_shared'

export const onRequestGet = async ({ env, request, params }: { env: Env; request: Request; params: Record<string,string> }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)
  const slug = publicCourseSlug(params.slug)
  if (!slug) return json({ error: 'Trilha não encontrada' }, 404)

  const path = await db.prepare(`SELECT * FROM academy_public_learning_paths WHERE tenant_id=? AND slug=? AND visibility='public' LIMIT 1`)
    .bind(context.tenantId, slug).first()
  if (!path) return json({ error: 'Trilha não encontrada' }, 404)

  const courses = await db.prepare(`
    SELECT c.id,c.title,c.description,c.instructor_label,c.certificate_type,pc.position,
      cp.slug,cp.category,cp.level_label,cp.short_description,cp.audience_text,cp.cover_ref,
      cp.access_model,cp.list_price_cents,cp.currency,cp.featured,
      COALESCE((SELECT SUM(l.duration_minutes) FROM academy_course_lessons l WHERE l.tenant_id=c.tenant_id AND l.course_id=c.id),0) AS workload_minutes,
      (SELECT COUNT(*) FROM academy_course_lessons l WHERE l.tenant_id=c.tenant_id AND l.course_id=c.id) AS lesson_count,
      (SELECT COUNT(*) FROM academy_course_modules m WHERE m.tenant_id=c.tenant_id AND m.course_id=c.id) AS module_count
    FROM academy_public_learning_path_courses pc
    JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id AND c.status='published'
    JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id AND cp.visibility='public'
    LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
    LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
    WHERE pc.tenant_id=? AND pc.path_id=?
      AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
    ORDER BY pc.position
  `).bind(context.tenantId, path.id).all()
  if (!(courses.results as any[]).length) return json({ error: 'Trilha não disponível neste catálogo' }, 404)

  const mapped = (courses.results as any[]).map((row) => ({
    id: row.id, slug: row.slug, title: row.title, description: row.short_description || row.description || '',
    category: row.category ?? null, levelLabel: row.level_label ?? null, audienceText: row.audience_text ?? null,
    coverRef: row.cover_ref ?? null, instructorLabel: row.instructor_label ?? null, certificateType: row.certificate_type ?? 'free_course',
    accessModel: row.access_model, listPriceCents: row.list_price_cents == null ? null : Number(row.list_price_cents), currency: row.currency,
    featured: Number(row.featured) === 1, workloadMinutes: Number(row.workload_minutes ?? 0), lessonCount: Number(row.lesson_count ?? 0),
    moduleCount: Number(row.module_count ?? 0), position: Number(row.position), checkoutReady: false,
  }))
  return json({ brand: context.brand, data: {
    id: path.id, slug: path.slug, title: path.title, shortDescription: path.short_description ?? null,
    description: path.description ?? '', category: path.category ?? null, coverRef: path.cover_ref ?? null,
    featured: Number(path.featured) === 1, accessModel: path.access_model,
    listPriceCents: path.list_price_cents == null ? null : Number(path.list_price_cents), currency: path.currency,
    seoTitle: path.seo_title ?? null, seoDescription: path.seo_description ?? null,
    courseCount: mapped.length, workloadMinutes: mapped.reduce((total, course) => total + course.workloadMinutes, 0),
    courses: mapped, enrollmentRequiresAuthentication: true, checkoutReady: false,
  } })
}
