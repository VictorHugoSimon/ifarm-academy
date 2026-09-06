import { publicCourseSlug, resolvePublicTenant } from '../../_publicTenant'
import { dbOr503, json, type Env } from '../../_shared'

export const onRequestGet = async ({ env, request, params }: { env: Env; request: Request; params: Record<string,string> }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)
  const slug = publicCourseSlug(params.slug)
  if (!slug) return json({ error: 'Curso não encontrado' }, 404)

  const course = await db.prepare(`
    SELECT c.id,c.title,c.description,c.instructor_label,c.certificate_type,
      p.slug,p.category,p.level_label,p.short_description,p.audience_text,p.cover_ref,
      p.access_model,p.list_price_cents,p.currency,p.featured,p.seo_title,p.seo_description,
      COALESCE(SUM(l.duration_minutes),0) AS workload_minutes,
      COUNT(DISTINCT l.id) AS lesson_count,
      COUNT(DISTINCT m.id) AS module_count,
      wc.course_id AS selected_course
    FROM academy_course_public_profiles p
    JOIN academy_courses c ON c.id=p.course_id AND c.tenant_id=p.tenant_id AND c.status='published'
    LEFT JOIN academy_course_modules m ON m.tenant_id=c.tenant_id AND m.course_id=c.id
    LEFT JOIN academy_course_lessons l ON l.tenant_id=c.tenant_id AND l.course_id=c.id
    LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
    LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
    WHERE p.tenant_id=? AND p.slug=? AND p.visibility='public'
      AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
    GROUP BY c.id,p.course_id
    LIMIT 1
  `).bind(context.tenantId, slug).first()
  if (!course) return json({ error: 'Curso não encontrado' }, 404)

  const modules = await db.prepare(`
    SELECT m.id,m.title,m.description,m.position,
      COUNT(l.id) AS lesson_count,
      COALESCE(SUM(l.duration_minutes),0) AS duration_minutes
    FROM academy_course_modules m
    LEFT JOIN academy_course_lessons l ON l.tenant_id=m.tenant_id AND l.module_id=m.id
    WHERE m.tenant_id=? AND m.course_id=?
    GROUP BY m.id
    ORDER BY m.position,m.created_at
  `).bind(context.tenantId, course.id).all()

  return json({
    brand: context.brand,
    data: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description ?? '',
      shortDescription: course.short_description ?? null,
      category: course.category ?? null,
      levelLabel: course.level_label ?? null,
      audienceText: course.audience_text ?? null,
      coverRef: course.cover_ref ?? null,
      instructorLabel: course.instructor_label ?? null,
      certificateType: course.certificate_type ?? 'free_course',
      accessModel: course.access_model,
      listPriceCents: course.list_price_cents == null ? null : Number(course.list_price_cents),
      currency: course.currency,
      featured: Number(course.featured) === 1,
      workloadMinutes: Number(course.workload_minutes ?? 0),
      moduleCount: Number(course.module_count ?? 0),
      lessonCount: Number(course.lesson_count ?? 0),
      seoTitle: course.seo_title ?? null,
      seoDescription: course.seo_description ?? null,
      modules: (modules.results as any[]).map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        position: Number(row.position ?? 0),
        lessonCount: Number(row.lesson_count ?? 0),
        durationMinutes: Number(row.duration_minutes ?? 0),
      })),
      enrollmentRequiresAuthentication: true,
      checkoutReady: false,
    },
  })
}
