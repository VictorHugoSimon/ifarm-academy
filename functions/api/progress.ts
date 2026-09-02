import { requireTrustedContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const courseId = new URL(request.url).searchParams.get('courseId')
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const result = await db.prepare(`
    SELECT * FROM academy_progress
    WHERE tenant_id=? AND student_id=? AND course_id=?
    ORDER BY updated_at DESC
  `).bind(context.tenantId, context.userId, courseId).all()

  return json({ data: result.results })
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const courseId = String(body.courseId ?? '')
  const lessonId = String(body.lessonId ?? '')
  const progressPercent = Number(body.progressPercent)
  if (!courseId || !lessonId) return json({ error: 'courseId e lessonId são obrigatórios' }, 400)
  if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) {
    return json({ error: 'progressPercent deve estar entre 0 e 100' }, 400)
  }

  const now = new Date().toISOString()
  const completedAt = progressPercent >= 100 ? now : null

  await db.prepare(`
    INSERT INTO academy_progress (
      student_id, course_id, lesson_id, progress_percent,
      completed_at, updated_at, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id, course_id, lesson_id) DO UPDATE SET
      progress_percent=excluded.progress_percent,
      completed_at=excluded.completed_at,
      updated_at=excluded.updated_at,
      tenant_id=excluded.tenant_id
  `).bind(
    context.userId,
    courseId,
    lessonId,
    Math.round(progressPercent),
    completedAt,
    now,
    context.tenantId,
  ).run()

  return json({
    data: {
      tenantId: context.tenantId,
      studentId: context.userId,
      courseId,
      lessonId,
      progressPercent: Math.round(progressPercent),
      completedAt,
      updatedAt: now,
    },
  })
}
