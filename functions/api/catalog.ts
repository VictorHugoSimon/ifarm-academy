import { requireTrustedContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const result = await db.prepare(`
    SELECT
      c.id,
      c.title,
      c.description,
      c.quiz_enabled,
      c.minimum_score,
      c.updated_at,
      COALESCE((SELECT s.featured FROM academy_white_label_catalog_courses s
        WHERE s.tenant_id=c.tenant_id AND s.course_id=c.id AND s.visible=1 LIMIT 1),0) AS featured,
      (SELECT COUNT(*) FROM academy_course_modules m
       WHERE m.tenant_id=c.tenant_id AND m.course_id=c.id) AS module_count,
      (SELECT COUNT(*) FROM academy_course_lessons l
       WHERE l.tenant_id=c.tenant_id AND l.course_id=c.id) AS lesson_count,
      (SELECT COUNT(*) FROM academy_course_lessons l
       WHERE l.tenant_id=c.tenant_id AND l.course_id=c.id AND l.required=1) AS required_lesson_count
    FROM academy_courses c
    WHERE c.tenant_id=? AND c.status='published'
      AND (
        COALESCE((SELECT w.catalog_mode FROM academy_white_label_settings w
          WHERE w.tenant_id=c.tenant_id AND w.status='active' LIMIT 1),'all_tenant_courses')='all_tenant_courses'
        OR EXISTS (
          SELECT 1 FROM academy_white_label_catalog_courses s
          WHERE s.tenant_id=c.tenant_id AND s.course_id=c.id AND s.visible=1
        )
      )
    ORDER BY featured DESC, c.title ASC
  `).bind(context.tenantId).all()

  return json({
    data: (result.results as any[]).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      moduleCount: Number(row.module_count ?? 0),
      lessonCount: Number(row.lesson_count ?? 0),
      requiredLessonCount: Number(row.required_lesson_count ?? 0),
      assessmentRequired: Number(row.quiz_enabled) === 1,
      minimumScore: Number(row.minimum_score ?? 0),
      featured: Number(row.featured) === 1,
      updatedAt: row.updated_at,
    })),
  })
}
