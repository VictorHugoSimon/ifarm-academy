import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { tryCompleteEnrollment } from './_completion'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const MAX_RESUME_POSITION_SECONDS = 24 * 60 * 60

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const courseId = new URL(request.url).searchParams.get('courseId')?.trim() ?? ''
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const enrollment = await db.prepare(`
    SELECT e.*, lc.status AS cycle_status, lc.cycle_number
    FROM academy_enrollments e
    LEFT JOIN academy_learning_cycles lc ON lc.tenant_id=e.tenant_id AND lc.id=e.active_cycle_id
    WHERE e.tenant_id=? AND e.student_id=? AND e.course_id=?
    LIMIT 1
  `).bind(context.tenantId, context.userId, courseId).first()
  if (!enrollment || String(enrollment.status) === 'cancelled') {
    return json({ error: 'Matrícula ativa é obrigatória para consultar o progresso' }, 403)
  }
  const cycleId = String(enrollment.active_cycle_id ?? '').trim()
  if (!cycleId) return json({ error: 'Ciclo acadêmico atual não encontrado' }, 409)

  const result = await db.prepare(`
    SELECT * FROM academy_progress
    WHERE tenant_id=? AND student_id=? AND course_id=? AND cycle_id=?
    ORDER BY updated_at DESC
  `).bind(context.tenantId, context.userId, courseId, cycleId).all()

  return json({ data: result.results, cycle: {
    id: cycleId,
    number: enrollment.cycle_number == null ? null : Number(enrollment.cycle_number),
    status: enrollment.cycle_status ?? null,
  } })
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
  if (!Number.isFinite(requestedPosition) || requestedPosition < 0 || requestedPosition > MAX_RESUME_POSITION_SECONDS) {
    return json({ error: 'lastPositionSeconds deve estar entre 0 e 86400' }, 400)
  }

  const enrollment = await db.prepare(`
    SELECT e.*, lc.status AS cycle_status, lc.cycle_number
    FROM academy_enrollments e
    LEFT JOIN academy_learning_cycles lc ON lc.tenant_id=e.tenant_id AND lc.id=e.active_cycle_id
    WHERE e.tenant_id=? AND e.student_id=? AND e.course_id=?
    LIMIT 1
  `).bind(context.tenantId, context.userId, courseId).first()
  if (!enrollment) return json({ error: 'Matrícula não encontrada' }, 403)
  if (String(enrollment.status) === 'cancelled') return json({ error: 'Matrícula cancelada não permite registrar progresso' }, 403)
  const cycleId = String(enrollment.active_cycle_id ?? '').trim()
  if (!cycleId || String(enrollment.cycle_status ?? '') !== 'active') {
    return json({ error: 'Ciclo acadêmico ativo é obrigatório para registrar progresso' }, 409)
  }

  const lesson = await db.prepare(`
    SELECT id, content_type
    FROM academy_course_lessons
    WHERE tenant_id=? AND course_id=? AND id=?
    LIMIT 1
  `).bind(context.tenantId, courseId, lessonId).first()
  if (!lesson) return json({ error: 'Aula não pertence a este curso/tenant' }, 404)

  const current = await db.prepare(`
    SELECT progress_percent, last_position_seconds, completed_at
    FROM academy_progress
    WHERE tenant_id=? AND student_id=? AND course_id=? AND cycle_id=? AND lesson_id=?
    LIMIT 1
  `).bind(context.tenantId, context.userId, courseId, cycleId, lessonId).first()

  const progressPercent = Math.max(Number(current?.progress_percent ?? 0), Math.round(requestedProgress))
  const lastPositionSeconds = Math.round(requestedPosition)
  const now = new Date().toISOString()
  const completedAt = progressPercent >= 100 ? String(current?.completed_at ?? now) : null

  await db.prepare(`
    INSERT INTO academy_progress (
      cycle_id, student_id, course_id, lesson_id, progress_percent,
      completed_at, updated_at, tenant_id, last_position_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cycle_id, lesson_id) DO UPDATE SET
      progress_percent=excluded.progress_percent,
      completed_at=excluded.completed_at,
      updated_at=excluded.updated_at,
      last_position_seconds=excluded.last_position_seconds
  `).bind(
    cycleId,
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
    cycleId,
  })

  if (completion.newlyCompleted) {
    await auditStatement(db, context, {
      action: 'learning_cycle.completed',
      resourceType: 'learning_cycle',
      resourceId: cycleId,
      metadata: { enrollmentId: enrollment.id, courseId, cycleNumber: enrollment.cycle_number, completedAt: completion.completedAt },
    }).run()
  }

  if (completion.certificate?.issued && completion.certificate.certificate) {
    await auditStatement(db, context, {
      action: 'certificate.auto_issued',
      resourceType: 'certificate',
      resourceId: String(completion.certificate.certificate.id ?? ''),
      metadata: { source: 'lesson_progress', courseId, cycleId },
    }).run()
  }

  return json({ data: {
    tenantId: context.tenantId,
    studentId: context.userId,
    courseId,
    cycleId,
    cycleNumber: enrollment.cycle_number == null ? null : Number(enrollment.cycle_number),
    lessonId,
    progressPercent,
    lastPositionSeconds,
    completedAt,
    updatedAt: now,
    enrollmentCompletion: completion,
  } })
}
