import { requireTrustedContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const url = new URL(request.url)
  const status = url.searchParams.get('status')?.trim() ?? ''
  const allowed = new Set(['unread','read','archived'])
  if (status && !allowed.has(status)) return json({ error: 'status inválido' }, 400)

  const query = `
    SELECT id,category,notification_type,title,message,action_path,priority,status,required,
      source_type,source_id,payload_json,created_at,read_at,archived_at,expires_at
    FROM academy_notifications
    WHERE tenant_id=? AND user_id=?
      AND (?='' OR status=?)
      AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))
    ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END, created_at DESC
    LIMIT 100
  `
  const result = await db.prepare(query).bind(auth.tenantId, auth.userId, status, status).all()
  const unread = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_notifications
    WHERE tenant_id=? AND user_id=? AND status='unread'
      AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))
  `).bind(auth.tenantId, auth.userId).first()

  return json({
    data: (result.results as any[]).map((row) => ({
      id: row.id,
      category: row.category,
      notificationType: row.notification_type,
      title: row.title,
      message: row.message,
      actionPath: row.action_path ?? null,
      priority: row.priority,
      status: row.status,
      required: Number(row.required) === 1,
      sourceType: row.source_type ?? null,
      sourceId: row.source_id ?? null,
      payload: (() => { try { return JSON.parse(String(row.payload_json ?? '{}')) } catch { return {} } })(),
      createdAt: row.created_at,
      readAt: row.read_at ?? null,
      archivedAt: row.archived_at ?? null,
      expiresAt: row.expires_at ?? null,
    })),
    unreadCount: Number(unread?.total ?? 0),
  })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const action = String(body.action ?? '').trim()
  const now = new Date().toISOString()
  if (action === 'mark_all_read') {
    await db.prepare(`
      UPDATE academy_notifications SET status='read',read_at=COALESCE(read_at,?)
      WHERE tenant_id=? AND user_id=? AND status='unread'
    `).bind(now, auth.tenantId, auth.userId).run()
    return json({ data: { action, updatedAt: now } })
  }

  const id = String(body.id ?? '').trim()
  if (!id) return json({ error: 'id é obrigatório' }, 400)
  const notification = await db.prepare(`SELECT id,status FROM academy_notifications WHERE tenant_id=? AND user_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId, auth.userId, id).first()
  if (!notification) return json({ error: 'Notificação não encontrada' }, 404)

  if (action === 'mark_read') {
    await db.prepare(`UPDATE academy_notifications SET status='read',read_at=COALESCE(read_at,?) WHERE tenant_id=? AND user_id=? AND id=?`)
      .bind(now, auth.tenantId, auth.userId, id).run()
  } else if (action === 'archive') {
    await db.prepare(`UPDATE academy_notifications SET status='archived',archived_at=COALESCE(archived_at,?),read_at=COALESCE(read_at,?) WHERE tenant_id=? AND user_id=? AND id=?`)
      .bind(now, now, auth.tenantId, auth.userId, id).run()
  } else {
    return json({ error: 'action inválida' }, 400)
  }

  return json({ data: { id, action, updatedAt: now } })
}
