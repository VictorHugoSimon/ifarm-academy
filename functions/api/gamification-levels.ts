import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin','ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const result = await db.prepare(`SELECT * FROM academy_gamification_levels WHERE tenant_id=? ORDER BY min_xp,position`).bind(auth.tenantId).all()
  return json({ data: result.results })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const name = String(body.name ?? '').trim()
  const minXp = Number(body.minXp)
  const position = Number(body.position)
  if (!name) return json({ error: 'name é obrigatório' }, 400)
  if (!Number.isInteger(minXp) || minXp < 0) return json({ error: 'minXp deve ser inteiro >= 0' }, 400)
  if (!Number.isInteger(position) || position < 0) return json({ error: 'position deve ser inteiro >= 0' }, 400)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  try {
    await db.batch([
      db.prepare(`
        INSERT INTO academy_gamification_levels
        (id,tenant_id,name,min_xp,position,status,created_by,created_at,updated_at)
        VALUES (?,?,?,?,?,'active',?,?,?)
      `).bind(id, auth.tenantId, name, minXp, position, auth.userId, now, now),
      auditStatement(db, auth, {
        action: 'gamification.level_created',
        resourceType: 'gamification_level',
        resourceId: id,
        metadata: { name, minXp, position },
      }),
    ])
  } catch {
    return json({ error: 'Faixa de XP ou posição já utilizada neste tenant' }, 409)
  }
  return json({ data: { id, name, minXp, position, status: 'active' } }, 201)
}
