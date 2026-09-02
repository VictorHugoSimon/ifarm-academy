import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { tryCompleteEnrollment } from './_completion'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const courseId = new URL(request.url).searchParams.get('courseId')?.trim() ?? ''
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const enrollment = await db.prepare(`
    SELECT id, status FROM academy_enrollments
    WHERE tenant_id=? AND student_id=? AND course_id=?
    LIMIT 1
  `).bind(context.tenantId, context.userId, courseId).first()
  if (!enrollment || String(enrollment.status) === 'cancelled') {
    return json({ error: 'Matrícula ativa é obrigatória para consultar o progresso' }, 403)
  }

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

  const courseId = String(body.courseId ?? '').trim()
  const lessonId = String(body.lessonId ?? '').trim()
  const requestedProgress = Number(body.progressPercent)
  const requestedPosition = Number(body.lastPositionSeconds ?? 0)
  if (!courseId || !lessonId) return json({ error: 'courseId e lessonId são obrigatórios' }, 400)
  if (!Number.isFinite(requestedProgress) || requestedProgress < 0 || requestedProgress > 100) {
    return json({ error: 'progressPercent deve estar entre 0 e 100' }, 400)
  }
  if (!Number.isFinite(requestedPosition) || requestedPosition < 0) {
    return json({ error: 'lastPositionSeconds deve ser zero ou positivo' }, 400)
  }

  const enrollment = await db.prepare(`
    SELECT * FROM academy_enrollments
    WHERE tenant_id=? AND student_id=? AND course_id=?
    LIMIT 1
  `).bind(context.tenantId, context.userId, courseId).first()
  if (!enrollment) return json({ error: 'Matrícula não encontrada' }, 403)
  if (String(enrollment.status) === 'cancelled') return json({ error: 'Matrícula cancelada não permite registrar progresso' }, 403)

  const lesson = await db.prepare(`
    SELECT id, duration_minutes
    FROM academy_course_lessons
    WHERE tenant_id=? AND course_id=? AND id=?
    LIMIT 1
  `).bind(context.tenantId, courseId, lessonId).first()
  if (!lesson) return json({ error: 'Aula não pertence a este curso/tenant' }, 404)

  const current = await db.prepare(`
    SELECT progress_percent, last_position_seconds, completed_at
    FROM academy_progress
    WHERE tenant_id=? AND student_id=? AND course_id=? AND lesson_id=?
    LIMIT 1
  `).bind(context.tenantId, context.userId, courseId, lessonId).first()

  const progressPercent = Math.max(Number(current?.progress_percent ?? 0), Math.round(requestedProgress))
  const durationSeconds = Math.max(0, Number(lesson.duration_minutes ?? 0) * 60)
  const lastPositionSeconds = durationSeconds > 0
    ? Math.min(Math.round(requestedPosition), durationSeconds)
    : Math.round(requestedPosition)
  const now = new Date().toISOString()
  const completedAt = progressPercent >= 100
    ? String(current?.completed_at ?? now)
    : null

  await db.prepare(`
    INSERT INTO academy_progress (
      student_id, course_id, lesson_id, progress_percent,
      completed_at, updated_at, tenant_id, last_position_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id, course_id, lesson_id) DO UPDATE SET
      progress_percent=excluded.progress_percent,
      completed_at=excluded.completed_at,
      updated_at=excluded.updated_at,
      tenant_id=excluded.tenant_id,
      last_position_seconds=excluded.last_position_seconds
  `).bind(
    context.userId,
    courseId,
    lessonId,
    progressPercent,
    completedAt,
    now,
    context.tenantId,
    lastPositionSeconds,
  ).run()

  const completion = await tryCompleteEnrollment(db, {
    tenantId: context.tenantId,
    studentId: context.userId,
    studentName: context.displayName ?? enrollment.student_name_snapshot ?? null,
    courseId,
  })

  if (completion.completed && String(enrollment.status) !== 'completed') {
    await auditStatement(db, context, {
      action: 'enrollment.completed',
      resourceType: 'enrollment',
      resourceId: String(enrollment.id),
      metadata: { courseId, completedAt: completion.completedAt },
    }).run()
  }

  if (completion.completed && completion.certificate?.issued && completion.certificate.certificate) {
    await auditStatement(db, context, {
      action: 'certificate.auto_issued',
      resourceType: 'certificate',
      resourceId: String(completion.certificate.certificate.id ?? ''),
      metadata: { source: 'lesson_progress', courseId },
    }).run()
  }

  return json({
    data: {
      tenantId: context.tenantId,
      studentId: context.userId,
      courseId,
      lessonId,
      progressPercent,
      lastPositionSeconds,
      completedAt,
      updatedAt: now,
      enrollmentCompletion: completion,
    },
  })
}
