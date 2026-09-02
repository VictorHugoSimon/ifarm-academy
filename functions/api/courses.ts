import { requireAdminContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

const allowedRoles = ['academy_admin', 'academy_instructor', 'instructor', 'ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const result = await db.prepare(`
    SELECT
      c.id,
      c.title,
      c.status,
      c.updated_at,
      (SELECT COUNT(*) FROM academy_course_modules m
       WHERE m.tenant_id=c.tenant_id AND m.course_id=c.id) AS module_count,
      (SELECT COUNT(*) FROM academy_course_lessons l
       WHERE l.tenant_id=c.tenant_id AND l.course_id=c.id) AS lesson_count
    FROM academy_courses c
    WHERE c.tenant_id=? AND c.status!='archived'
    ORDER BY c.updated_at DESC, c.title ASC
  `).bind(auth.tenantId).all()

  return json({
    data: (result.results as any[]).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      moduleCount: Number(row.module_count ?? 0),
      lessonCount: Number(row.lesson_count ?? 0),
      updatedAt: row.updated_at,
    })),
  })
}
