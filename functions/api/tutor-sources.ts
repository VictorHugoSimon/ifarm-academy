import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { rebuildTutorIndex } from './_tutorIndex'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const allowedRoles = ['academy_admin', 'academy_instructor', 'instructor', 'ifarm_admin']

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const courseId = String(body.courseId ?? '').trim()
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  try {
    const result = await rebuildTutorIndex(db, auth.tenantId, courseId)
    await db.batch([
      auditStatement(db, auth, {
        action: 'tutor.sources.rebuilt',
        resourceType: 'course',
        resourceId: courseId,
        metadata: { lessonCount: result.lessonCount, chunkCount: result.chunkCount, mode: 'evidence_only' },
      }),
    ])
    return json({ data: result })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'TUTOR_INDEX_FAILED'
    if (code === 'TUTOR_COURSE_NOT_FOUND') return json({ error: 'Curso não encontrado neste tenant' }, 404)
    if (code === 'TUTOR_COURSE_NOT_PUBLISHED') return json({ error: 'Somente cursos publicados podem alimentar o Tutor IA' }, 409)
    if (code === 'TUTOR_CONTENT_NOT_AUTHORIZED') return json({ error: 'O uso deste curso pelo Tutor IA ainda não foi autorizado' }, 403)
    return json({ error: 'Não foi possível reconstruir as fontes do Tutor IA' }, 500)
  }
}
