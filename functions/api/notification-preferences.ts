import { requireTrustedContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const CATEGORIES = ['academic','compliance','event','commercial','system'] as const

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const result = await db.prepare(`
    SELECT category,in_app_enabled,email_enabled,push_enabled,updated_at
    FROM academy_notification_preferences
    WHERE tenant_id=? AND user_id=?
  `).bind(auth.tenantId, auth.userId).all()
  const byCategory = new Map((result.results as any[]).map((row) => [String(row.category), row]))
  return json({ data: CATEGORIES.map((category) => {
    const row = byCategory.get(category)
    return {
      category,
      inAppEnabled: row ? Number(row.in_app_enabled) === 1 : true,
      emailEnabled: false,
      pushEnabled: false,
      externalChannelsAvailable: false,
      updatedAt: row?.updated_at ?? null,
    }
  }) })
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const category = String(body.category ?? '').trim()
  if (!CATEGORIES.includes(category as any)) return json({ error: 'category inválida' }, 400)
  const enabled = body.inAppEnabled === true
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO academy_notification_preferences
      (tenant_id,user_id,category,in_app_enabled,email_enabled,push_enabled,updated_at)
    VALUES (?,?,?, ?,0,0,?)
    ON CONFLICT(tenant_id,user_id,category) DO UPDATE SET
      in_app_enabled=excluded.in_app_enabled,
      email_enabled=0,
      push_enabled=0,
      updated_at=excluded.updated_at
  `).bind(auth.tenantId, auth.userId, category, enabled ? 1 : 0, now).run()
  return json({ data: { category, inAppEnabled: enabled, emailEnabled: false, pushEnabled: false, updatedAt: now } })
}
