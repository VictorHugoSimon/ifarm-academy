import { auditStatement } from '../../_audit'
import { requireAdminContext } from '../../_auth'
import { normalizeMaterialSize } from '../../_materialStorage'
import { dbOr503, json, storageOr503, type Env } from '../../_shared'

const editorRoles = ['academy_admin', 'academy_instructor', 'instructor', 'ifarm_admin']

export const onRequestPut = async ({ env, request, params }: {
  env: Env
  request: Request
  params: Record<string, string>
}) => {
  const auth = requireAdminContext(env, request, editorRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const storage = storageOr503(env); if (storage instanceof Response) return storage

  const id = String(params.id ?? '').trim()
  if (!id) return json({ error: 'Material inválido' }, 400)

  const asset = await db.prepare(`
    SELECT a.*, c.status AS course_status
    FROM academy_material_assets a
    JOIN academy_courses c ON c.tenant_id=a.tenant_id AND c.id=a.course_id
    WHERE a.tenant_id=? AND a.id=?
    LIMIT 1
  `).bind(auth.tenantId, id).first()

  if (!asset) return json({ error: 'Material não encontrado neste tenant' }, 404)
  if (String(asset.status) === 'deleted') return json({ error: 'Material removido' }, 410)
  if (String(asset.course_status) !== 'draft') {
    return json({ error: 'Upload bloqueado porque o curso não está em draft' }, 409)
  }

  const declaredSize = normalizeMaterialSize(
    request.headers.get('x-ifarm-file-size') ?? request.headers.get('content-length'),
  )
  if (!declaredSize) return json({ error: 'Cabeçalho de tamanho do arquivo ausente ou inválido' }, 400)
  if (declaredSize !== Number(asset.size_bytes)) {
    return json({ error: 'Tamanho enviado não corresponde ao material reservado' }, 409)
  }

  const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!contentType || contentType !== String(asset.mime_type).toLowerCase()) {
    return json({ error: 'Content-Type não corresponde ao material reservado' }, 409)
  }
  if (!request.body) return json({ error: 'Corpo do arquivo ausente' }, 400)

  let stored: any
  try {
    stored = await storage.put(String(asset.object_key), request.body, {
      httpMetadata: { contentType },
      customMetadata: {
        tenantId: auth.tenantId,
        courseId: String(asset.course_id),
        lessonId: String(asset.lesson_id),
        assetId: id,
      },
    })
  } catch {
    const now = new Date().toISOString()
    await db.prepare(`
      UPDATE academy_material_assets SET status='failed', updated_at=?
      WHERE tenant_id=? AND id=?
    `).bind(now, auth.tenantId, id).run()
    return json({ error: 'Falha ao armazenar material' }, 502)
  }

  const now = new Date().toISOString()
  const etag = stored?.httpEtag ?? stored?.etag ?? null
  await db.batch([
    db.prepare(`
      UPDATE academy_material_assets
      SET status='ready', storage_etag=?, updated_at=?
      WHERE tenant_id=? AND id=?
    `).bind(etag, now, auth.tenantId, id),
    auditStatement(db, auth, {
      action: 'material.uploaded',
      resourceType: 'material_asset',
      resourceId: id,
      metadata: {
        courseId: asset.course_id,
        lessonId: asset.lesson_id,
        fileName: asset.original_filename,
        sizeBytes: declaredSize,
      },
    }),
  ])

  return json({
    data: {
      id,
      status: 'ready',
      provider: 'academy_storage',
      providerRef: id,
      fileName: asset.original_filename,
      mimeType: asset.mime_type,
      sizeBytes: declaredSize,
      updatedAt: now,
    },
  })
}
