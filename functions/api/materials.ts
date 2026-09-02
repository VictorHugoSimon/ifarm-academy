import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import {
  buildMaterialObjectKey,
  normalizeFileName,
  normalizeMaterialSize,
  resolveMaterialMime,
  storageConfigured,
} from './_materialStorage'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const editorRoles = ['academy_admin', 'academy_instructor', 'instructor', 'ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, editorRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const url = new URL(request.url)
  const courseId = url.searchParams.get('courseId')?.trim() ?? ''
  const lessonId = url.searchParams.get('lessonId')?.trim() ?? ''

  let sql = `
    SELECT id, tenant_id, course_id, lesson_id, original_filename, mime_type,
           size_bytes, storage_provider, status, created_by, created_at, updated_at
    FROM academy_material_assets
    WHERE tenant_id=? AND status!='deleted'
  `
  const values: unknown[] = [auth.tenantId]
  if (courseId) { sql += ' AND course_id=?'; values.push(courseId) }
  if (lessonId) { sql += ' AND lesson_id=?'; values.push(lessonId) }
  sql += ' ORDER BY created_at DESC'

  const result = await db.prepare(sql).bind(...values).all()
  return json({
    data: (result.results as any[]).map((row) => ({
      id: row.id,
      courseId: row.course_id,
      lessonId: row.lesson_id,
      fileName: row.original_filename,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      provider: row.storage_provider,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    storageConfigured: storageConfigured(env),
  })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, editorRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const courseId = String(body.courseId ?? '').trim()
  const lessonId = String(body.lessonId ?? '').trim()
  const fileName = normalizeFileName(body.fileName)
  const sizeBytes = normalizeMaterialSize(body.sizeBytes)
  if (!courseId || !lessonId) return json({ error: 'courseId e lessonId são obrigatórios' }, 400)
  if (!fileName) return json({ error: 'Nome ou extensão de arquivo inválidos' }, 400)
  if (!sizeBytes) return json({ error: 'Tamanho de arquivo inválido ou acima do limite permitido' }, 400)

  const mimeType = resolveMaterialMime(fileName, body.mimeType)
  if (!mimeType) return json({ error: 'Tipo de arquivo não permitido ou incompatível com a extensão' }, 400)

  const lesson = await db.prepare(`
    SELECT l.id, c.status AS course_status
    FROM academy_course_lessons l
    JOIN academy_courses c ON c.tenant_id=l.tenant_id AND c.id=l.course_id
    WHERE l.tenant_id=? AND l.course_id=? AND l.id=?
    LIMIT 1
  `).bind(auth.tenantId, courseId, lessonId).first()

  if (!lesson) return json({ error: 'Aula não encontrada neste tenant' }, 404)
  if (String(lesson.course_status) !== 'draft') {
    return json({ error: 'Materiais só podem ser alterados enquanto o curso estiver em draft' }, 409)
  }

  const id = crypto.randomUUID()
  const objectKey = buildMaterialObjectKey({ tenantId: auth.tenantId, courseId, lessonId, assetId: id, fileName })
  const now = new Date().toISOString()

  await db.batch([
    db.prepare(`
      INSERT INTO academy_material_assets (
        id, tenant_id, course_id, lesson_id, object_key, original_filename,
        mime_type, size_bytes, storage_provider, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'academy_storage', 'pending', ?, ?, ?)
    `).bind(
      id, auth.tenantId, courseId, lessonId, objectKey, fileName,
      mimeType, sizeBytes, auth.userId, now, now,
    ),
    auditStatement(db, auth, {
      action: 'material.reserved',
      resourceType: 'material_asset',
      resourceId: id,
      metadata: { courseId, lessonId, fileName, mimeType, sizeBytes },
    }),
  ])

  return json({
    data: {
      id,
      courseId,
      lessonId,
      fileName,
      mimeType,
      sizeBytes,
      provider: 'academy_storage',
      status: 'pending',
      uploadUrl: `/api/materials/${encodeURIComponent(id)}/content`,
      storageConfigured: storageConfigured(env),
    },
  }, 201)
}
