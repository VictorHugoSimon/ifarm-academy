import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const result = await db.prepare(`
    SELECT i.*,
      SUM(CASE WHEN q.verification_status='verified' THEN 1 ELSE 0 END) AS verified_qualifications,
      COUNT(q.id) AS qualifications,
      (SELECT COUNT(*) FROM academy_course_instructor_roles r
       WHERE r.tenant_id=i.tenant_id AND r.instructor_id=i.id AND r.status='active') AS active_course_roles
    FROM academy_instructors i
    LEFT JOIN academy_instructor_qualifications q
      ON q.tenant_id=i.tenant_id AND q.instructor_id=i.id
    WHERE i.tenant_id=?
    GROUP BY i.id
    ORDER BY i.status='inactive', i.display_name_snapshot
  `).bind(auth.tenantId).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name_snapshot,
    bio: row.bio,
    status: row.status,
    qualifications: Number(row.qualifications ?? 0),
    verifiedQualifications: Number(row.verified_qualifications ?? 0),
    activeCourseRoles: Number(row.active_course_roles ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const userId = String(body.userId ?? '').trim()
  const displayName = String(body.displayName ?? '').trim()
  const bio = String(body.bio ?? '').trim()
  if (!userId || !displayName) return json({ error: 'userId e displayName são obrigatórios' }, 400)

  const existing = await db.prepare('SELECT * FROM academy_instructors WHERE tenant_id=? AND user_id=? LIMIT 1')
    .bind(auth.tenantId, userId).first()
  const now = new Date().toISOString()
  if (existing) {
    if (String(existing.status) === 'active') return json({ data: { id: existing.id, userId, displayName: existing.display_name_snapshot, status: 'active' }, idempotent: true })
    await db.batch([
      db.prepare(`UPDATE academy_instructors SET display_name_snapshot=?,bio=?,status='active',updated_at=? WHERE tenant_id=? AND id=?`)
        .bind(displayName, bio, now, auth.tenantId, existing.id),
      auditStatement(db, auth, { action: 'instructor.reactivated', resourceType: 'instructor', resourceId: String(existing.id), metadata: { userId, displayName } }),
    ])
    return json({ data: { id: existing.id, userId, displayName, bio, status: 'active', updatedAt: now }, reactivated: true })
  }

  const id = crypto.randomUUID()
  await db.batch([
    db.prepare(`INSERT INTO academy_instructors (id,tenant_id,user_id,display_name_snapshot,bio,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?,?)`)
      .bind(id, auth.tenantId, userId, displayName, bio, auth.userId, now, now),
    auditStatement(db, auth, { action: 'instructor.created', resourceType: 'instructor', resourceId: id, metadata: { userId, displayName } }),
  ])
  return json({ data: { id, userId, displayName, bio, status: 'active', createdAt: now, updatedAt: now } }, 201)
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const instructorId = String(body.instructorId ?? '').trim()
  if (!instructorId) return json({ error: 'instructorId é obrigatório' }, 400)

  const existing = await db.prepare('SELECT * FROM academy_instructors WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, instructorId).first()
  if (!existing) return json({ error: 'Instrutor não encontrado neste tenant' }, 404)
  const displayName = String(body.displayName ?? existing.display_name_snapshot).trim()
  const bio = String(body.bio ?? existing.bio ?? '').trim()
  const status = String(body.status ?? existing.status).trim()
  if (!displayName) return json({ error: 'displayName é obrigatório' }, 400)
  if (!['active','inactive'].includes(status)) return json({ error: 'status inválido' }, 400)
  const now = new Date().toISOString()

  await db.batch([
    db.prepare('UPDATE academy_instructors SET display_name_snapshot=?,bio=?,status=?,updated_at=? WHERE tenant_id=? AND id=?')
      .bind(displayName, bio, status, now, auth.tenantId, instructorId),
    auditStatement(db, auth, { action: 'instructor.updated', resourceType: 'instructor', resourceId: instructorId, metadata: { displayName, previousStatus: existing.status, status } }),
  ])
  return json({ data: { id: instructorId, userId: existing.user_id, displayName, bio, status, updatedAt: now } })
}
