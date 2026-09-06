import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin','ifarm_admin']
const EVENT_TYPES = new Set(['lesson_completed','course_completed','quiz_approved','certificate_issued','event_attended','smart_farm_activity'])

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const result = await db.prepare(`
    SELECT * FROM academy_gamification_rules
    WHERE tenant_id=? ORDER BY event_type,version DESC
  `).bind(auth.tenantId).all()
  return json({ data: result.results })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const eventType = String(body.eventType ?? '').trim()
  const points = Number(body.points)
  const rationale = String(body.rationale ?? '').trim()
  if (!EVENT_TYPES.has(eventType)) return json({ error: 'eventType inválido' }, 400)
  if (!Number.isInteger(points) || points < 0 || points > 1000000) return json({ error: 'points deve ser inteiro entre 0 e 1000000' }, 400)
  if (!rationale) return json({ error: 'rationale é obrigatório' }, 400)

  const previous = await db.prepare(`
    SELECT MAX(version) AS version FROM academy_gamification_rules WHERE tenant_id=? AND event_type=?
  `).bind(auth.tenantId, eventType).first()
  const version = Number(previous?.version ?? 0) + 1
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.batch([
    db.prepare(`UPDATE academy_gamification_rules SET status='retired' WHERE tenant_id=? AND event_type=? AND status='active'`)
      .bind(auth.tenantId, eventType),
    db.prepare(`
      INSERT INTO academy_gamification_rules
      (id,tenant_id,event_type,points,status,version,rationale,configured_by,configured_at,created_at)
      VALUES (?,?,?,?,'active',?,?,?,?,?)
    `).bind(id, auth.tenantId, eventType, points, version, rationale, auth.userId, now, now),
    auditStatement(db, auth, {
      action: 'gamification.rule_activated',
      resourceType: 'gamification_rule',
      resourceId: id,
      metadata: { eventType, points, version },
    }),
  ])

  return json({ data: { id, eventType, points, version, status: 'active', rationale, configuredAt: now } }, 201)
}
