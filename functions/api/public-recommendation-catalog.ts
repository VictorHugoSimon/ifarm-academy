import { requireAdminContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

function items(rows: any) {
  return (rows.results as any[]).map((row) => ({ id: String(row.id), label: String(row.label), meta: row.meta == null ? null : String(row.meta) }))
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const [courses, paths, instructors, events, plans, partners, bundles] = await Promise.all([
    db.prepare(`SELECT c.id,c.title AS label,cp.category AS meta FROM academy_courses c
      JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
      WHERE c.tenant_id=? AND c.status='published' ORDER BY c.title`).bind(auth.tenantId).all(),
    db.prepare(`SELECT id,title AS label,category AS meta FROM academy_public_learning_paths
      WHERE tenant_id=? AND visibility='public' ORDER BY title`).bind(auth.tenantId).all(),
    db.prepare(`SELECT p.instructor_id AS id,i.display_name AS label,p.headline AS meta
      FROM academy_instructor_public_profiles p JOIN academy_instructors i ON i.id=p.instructor_id AND i.tenant_id=p.tenant_id AND i.status='active'
      WHERE p.tenant_id=? AND p.visibility='public' ORDER BY i.display_name`).bind(auth.tenantId).all(),
    db.prepare(`SELECT id,title AS label,event_type AS meta FROM academy_events
      WHERE tenant_id=? AND status='published' ORDER BY starts_at DESC`).bind(auth.tenantId).all(),
    db.prepare(`SELECT id,name AS label,audience_type AS meta FROM academy_plans
      WHERE tenant_id=? AND status='public' ORDER BY name`).bind(auth.tenantId).all(),
    db.prepare(`SELECT id,display_name AS label,partner_type AS meta FROM academy_public_partners
      WHERE tenant_id=? AND status='public' ORDER BY display_name`).bind(auth.tenantId).all(),
    db.prepare(`SELECT id,title AS label,commercial_mode AS meta FROM academy_public_bundles
      WHERE tenant_id=? AND status='public' ORDER BY title`).bind(auth.tenantId).all(),
  ])

  return json({ data: {
    course: items(courses), path: items(paths), instructor: items(instructors), event: items(events),
    plan: items(plans), partner: items(partners), bundle: items(bundles),
  } })
}
