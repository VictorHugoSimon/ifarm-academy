import { requireTrustedContext } from './_auth'
import { resolveMediaPlayback } from './_media'
import { dbOr503, json, safeJson, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const url = new URL(request.url)
  const courseId = url.searchParams.get('courseId')?.trim() ?? ''
  const lessonId = url.searchParams.get('lessonId')?.trim() ?? ''
  if (!courseId || !lessonId) return json({ error: 'courseId e lessonId são obrigatórios' }, 400)

  const enrollment = await db.prepare(`
    SELECT id, status FROM academy_enrollments
    WHERE tenant_id=? AND course_id=? AND student_id=?
    LIMIT 1
  `).bind(context.tenantId, courseId, context.userId).first()
  if (!enrollment || String(enrollment.status) === 'cancelled') {
    return json({ error: 'Matrícula ativa é obrigatória para consumir mídia' }, 403)
  }

  const lesson = await db.prepare(`
    SELECT id, title, content_type, content_json
    FROM academy_course_lessons
    WHERE tenant_id=? AND course_id=? AND id=?
    LIMIT 1
  `).bind(context.tenantId, courseId, lessonId).first()
  if (!lesson) return json({ error: 'Aula não encontrada neste curso/tenant' }, 404)
  if (!['video', 'audio'].includes(String(lesson.content_type))) {
    return json({ error: 'Aula não é do tipo vídeo ou áudio' }, 409)
  }

  const descriptor = resolveMediaPlayback(safeJson(lesson.content_json, {}))
  if (!descriptor) return json({ error: 'Fonte de mídia ainda não configurada' }, 409)
  if (descriptor.mode === 'provider_pending') {
    return json({
      error: 'Provedor de streaming ainda não possui adapter ativo neste ambiente',
      provider: descriptor.provider,
      providerRef: descriptor.providerRef,
    }, 503)
  }

  return json({
    data: {
      courseId,
      lessonId,
      mediaType: lesson.content_type,
      provider: descriptor.provider,
      providerRef: descriptor.providerRef ?? null,
      playbackUrl: descriptor.playbackUrl,
    },
  })
}
