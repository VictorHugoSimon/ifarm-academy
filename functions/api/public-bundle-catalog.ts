import { requireAdminContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const [courses, paths, plans, partners] = await Promise.all([
    db.prepare(`
      SELECT c.id,c.title,cp.category
      FROM academy_courses c
      JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id AND cp.visibility='public'
      WHERE c.tenant_id=? AND c.status='published'
      ORDER BY c.title
    `).bind(auth.tenantId).all(),
    db.prepare(`SELECT id,title,category FROM academy_public_learning_paths WHERE tenant_id=? AND visibility='public' ORDER BY title`)
      .bind(auth.tenantId).all(),
    db.prepare(`SELECT id,name,audience_type FROM academy_plans WHERE tenant_id=? AND status='public' ORDER BY name`)
      .bind(auth.tenantId).all(),
    db.prepare(`SELECT id,display_name,partner_type FROM academy_public_partners WHERE tenant_id=? AND status='public' ORDER BY display_name`)
      .bind(auth.tenantId).all(),
  ])

  return json({
    data: {
      courses: (courses.results as any[]).map((row) => ({ id: row.id, label: row.title, meta: row.category ?? null })),
      paths: (paths.results as any[]).map((row) => ({ id: row.id, label: row.title, meta: row.category ?? null })),
      plans: (plans.results as any[]).map((row) => ({ id: row.id, label: row.name, meta: row.audience_type ?? null })),
      partners: (partners.results as any[]).map((row) => ({ id: row.id, label: row.display_name, meta: row.partner_type ?? null })),
    },
  })
}
