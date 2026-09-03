import { requireTrustedContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin', 'ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const admin = auth.roles.some((role) => ADMIN_ROLES.includes(role))

  if (admin) {
    const result = await db.prepare(`
      SELECT c.id,c.title,c.status,
        GROUP_CONCAT(DISTINCT i.display_name_snapshot) AS instructors
      FROM academy_courses c
      LEFT JOIN academy_course_instructor_roles r
        ON r.tenant_id=c.tenant_id AND r.course_id=c.id AND r.status='active' AND r.role IN ('author','instructor')
      LEFT JOIN academy_instructors i
        ON i.tenant_id=c.tenant_id AND i.id=r.instructor_id
      WHERE c.tenant_id=? AND c.status='published'
      GROUP BY c.id
      ORDER BY c.title
    `).bind(auth.tenantId).all()
    return json({ data: result.results })
  }

  const instructor = await db.prepare(`SELECT id FROM academy_instructors WHERE tenant_id=? AND user_id=? AND status='active' LIMIT 1`)
    .bind(auth.tenantId, auth.userId).first()
  if (!instructor) return json({ data: [] })

  const result = await db.prepare(`
    SELECT DISTINCT c.id,c.title,c.status
    FROM academy_courses c
    JOIN academy_course_instructor_roles r
      ON r.tenant_id=c.tenant_id AND r.course_id=c.id
    WHERE c.tenant_id=? AND c.status='published'
      AND r.instructor_id=? AND r.status='active' AND r.role IN ('author','instructor')
    ORDER BY c.title
  `).bind(auth.tenantId, instructor.id).all()
  return json({ data: result.results })
}
