import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const url = new URL(request.url)
  const studentId = url.searchParams.get('studentId')
  const courseId = url.searchParams.get('courseId')
  if (!studentId || !courseId) return json({ error: 'studentId e courseId são obrigatórios' }, 400)
  const result = await db.prepare(`SELECT * FROM academy_progress WHERE student_id = ? AND course_id = ? ORDER BY updated_at DESC`).bind(studentId, courseId).all()
  return json({ data: result.results })
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>; try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const studentId = String(body.studentId ?? ''), courseId = String(body.courseId ?? ''), lessonId = String(body.lessonId ?? '')
  const progressPercent = Number(body.progressPercent)
  if (!studentId || !courseId || !lessonId) return json({ error: 'studentId, courseId e lessonId são obrigatórios' }, 400)
  if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) return json({ error: 'progressPercent deve estar entre 0 e 100' }, 400)
  const now = new Date().toISOString(), completedAt = progressPercent >= 100 ? now : null
  await db.prepare(`INSERT INTO academy_progress (student_id, course_id, lesson_id, progress_percent, completed_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id, course_id, lesson_id) DO UPDATE SET progress_percent=excluded.progress_percent, completed_at=excluded.completed_at, updated_at=excluded.updated_at`)
    .bind(studentId, courseId, lessonId, Math.round(progressPercent), completedAt, now).run()
  return json({ data: { studentId, courseId, lessonId, progressPercent: Math.round(progressPercent), completedAt, updatedAt: now } })
}
