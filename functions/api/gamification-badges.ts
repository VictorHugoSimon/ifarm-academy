import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin','ifarm_admin']
const EVENT_TYPES = new Set(['lesson_completed','course_completed','quiz_approved','certificate_issued','event_attended','smart_farm_activity'])

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const result = await db.prepare(`SELECT * FROM academy_badges WHERE tenant_id=? ORDER BY status,title`).bind(auth.tenantId).all()
  return json({ data: result.results })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const code = String(body.code ?? '').trim().toUpperCase()
  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const criterionType = String(body.criterionType ?? '').trim()
  const criterionEventType = body.criterionEventType == null ? null : String(body.criterionEventType).trim()
  const criterionValue = Number(body.criterionValue)
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return json({ error: 'code inválido' }, 400)
  if (!title) return json({ error: 'title é obrigatório' }, 400)
  if (!['xp_total','event_count'].includes(criterionType)) return json({ error: 'criterionType inválido' }, 400)
  if (!Number.isInteger(criterionValue) || criterionValue < 1) return json({ error: 'criterionValue deve ser inteiro positivo' }, 400)
  if (criterionType === 'event_count' && (!criterionEventType || !EVENT_TYPES.has(criterionEventType))) {
    return json({ error: 'criterionEventType inválido' }, 400)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  try {
    await db.batch([
      db.prepare(`
        INSERT INTO academy_badges
        (id,tenant_id,code,title,description,criterion_type,criterion_event_type,criterion_value,status,created_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?, 'active',?,?,?)
      `).bind(id, auth.tenantId, code, title, description, criterionType, criterionType === 'xp_total' ? null : criterionEventType, criterionValue, auth.userId, now, now),
      auditStatement(db, auth, {
        action: 'gamification.badge_created',
        resourceType: 'gamification_badge',
        resourceId: id,
        metadata: { code, criterionType, criterionEventType, criterionValue },
      }),
    ])
  } catch {
    return json({ error: 'Badge duplicado ou configuração inválida' }, 409)
  }
  return json({ data: { id, code, title, description, criterionType, criterionEventType, criterionValue, status: 'active' } }, 201)
}
