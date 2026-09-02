import { requireAdminContext } from './_auth'
import { dbOr503, json, safeJson, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const url = new URL(request.url)
  const actorId = url.searchParams.get('actorId')
  const action = url.searchParams.get('action')
  const resourceType = url.searchParams.get('resourceType')
  const resourceId = url.searchParams.get('resourceId')
  const createdFrom = url.searchParams.get('createdFrom')
  const createdTo = url.searchParams.get('createdTo')
  const requestedLimit = Number(url.searchParams.get('limit') ?? 100)
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100

  let sql = 'SELECT * FROM academy_audit_events WHERE tenant_id=?'
  const values: Array<string | number> = [auth.tenantId]

  if (actorId) { sql += ' AND actor_id=?'; values.push(actorId) }
  if (action) { sql += ' AND action=?'; values.push(action) }
  if (resourceType) { sql += ' AND resource_type=?'; values.push(resourceType) }
  if (resourceId) { sql += ' AND resource_id=?'; values.push(resourceId) }
  if (createdFrom) { sql += ' AND created_at>=?'; values.push(createdFrom) }
  if (createdTo) { sql += ' AND created_at<=?'; values.push(createdTo) }
  sql += ' ORDER BY created_at DESC LIMIT ?'
  values.push(limit)

  const result = await db.prepare(sql).bind(...values).all()
  return json({
    data: result.results.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      actorRoles: safeJson(row.actor_roles_json, []),
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      metadata: safeJson(row.metadata_json, {}),
      createdAt: row.created_at,
    })),
    filters: { actorId, action, resourceType, resourceId, createdFrom, createdTo, limit },
  })
}
