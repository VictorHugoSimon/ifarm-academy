import { auditStatement } from '../_audit'
import { requireAdminContext, requireTrustedContext } from '../_auth'
import { materialDisposition } from '../_materialStorage'
import { dbOr503, json, storageOr503, type Env } from '../_shared'

const adminRoles = new Set(['academy_admin', 'academy_instructor', 'instructor', 'ifarm_admin'])
const editorRoles = [...adminRoles]

export const onRequestGet = async ({ env, request, params }: {
  env: Env
  request: Request
  params: Record<string, string>
}) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db
  const storage = storageOr503(env); if (storage instanceof Response) return storage

  const id = String(params.id ?? '').trim()
  const asset = await db.prepare(`
    SELECT * FROM academy_material_assets
    WHERE tenant_id=? AND id=? AND status='ready'
    LIMIT 1
  `).bind(context.tenantId, id).first()
  if (!asset) return json({ error: 'Material não encontrado ou indisponível' }, 404)

  const privileged = context.roles.some((role) => adminRoles.has(role))
  if (!privileged) {
    const enrollment = await db.prepare(`
      SELECT id FROM academy_enrollments
      WHERE tenant_id=? AND course_id=? AND student_id=? AND status IN ('active','completed')
      LIMIT 1
    `).bind(context.tenantId, asset.course_id, context.userId).first()
    if (!enrollment) return json({ error: 'Acesso ao material não autorizado' }, 403)
  }

  const object = await storage.get(String(asset.object_key))
  if (!object?.body) return json({ error: 'Objeto do material não encontrado no storage' }, 404)

  const fileName = String(asset.original_filename).replace(/[\r\n"]/g, '')
  const mimeType = String(asset.mime_type)
  const headers = new Headers({
    'content-type': mimeType,
    'content-disposition': `${materialDisposition(mimeType)}; filename="${fileName}"`,
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
  })
  if (object.httpEtag) headers.set('etag', String(object.httpEtag))
  if (Number(asset.size_bytes) > 0) headers.set('content-length', String(asset.size_bytes))

  return new Response(object.body, { status: 200, headers })
}

export const onRequestDelete = async ({ env, request, params }: {
  env: Env
  request: Request
  params: Record<string, string>
}) => {
  const auth = requireAdminContext(env, request, editorRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const id = String(params.id ?? '').trim()
  const asset = await db.prepare(`
    SELECT a.*, c.status AS course_status
    FROM academy_material_assets a
    JOIN academy_courses c ON c.tenant_id=a.tenant_id AND c.id=a.course_id
    WHERE a.tenant_id=? AND a.id=?
    LIMIT 1
  `).bind(auth.tenantId, id).first()
  if (!asset) return json({ error: 'Material não encontrado neste tenant' }, 404)
  if (String(asset.status) === 'deleted') return json({ data: { id, status: 'deleted' }, idempotent: true })
  if (String(asset.course_status) !== 'draft') {
    return json({ error: 'Material só pode ser removido enquanto o curso estiver em draft' }, 409)
  }

  if (String(asset.status) === 'ready') {
    const storage = storageOr503(env); if (storage instanceof Response) return storage
    await storage.delete(String(asset.object_key))
  }

  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`
      UPDATE academy_material_assets
      SET status='deleted', updated_at=?
      WHERE tenant_id=? AND id=?
    `).bind(now, auth.tenantId, id),
    auditStatement(db, auth, {
      action: 'material.deleted',
      resourceType: 'material_asset',
      resourceId: id,
      metadata: { courseId: asset.course_id, lessonId: asset.lesson_id, fileName: asset.original_filename },
    }),
  ])

  return json({ data: { id, status: 'deleted', updatedAt: now } })
}
