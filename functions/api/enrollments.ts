import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { learningCycleInsertStatement, nextCycleNumber } from './_cycle'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const result = await db.prepare(`
    SELECT
      e.*,
      c.title AS course_title,
      c.status AS course_status,
      c.quiz_enabled,
      c.minimum_score,
      lc.cycle_number,
      lc.status AS cycle_status,
      lc.source AS cycle_source,
      lc.started_at AS cycle_started_at,
      lc.completed_at AS cycle_completed_at,
      lc.due_at AS cycle_due_at
    FROM academy_enrollments e
    JOIN academy_courses c
      ON c.tenant_id=e.tenant_id AND c.id=e.course_id
    LEFT JOIN academy_learning_cycles lc
      ON lc.tenant_id=e.tenant_id AND lc.id=e.active_cycle_id
    WHERE e.tenant_id=? AND e.student_id=?
    ORDER BY e.enrolled_at DESC
  `).bind(context.tenantId, context.userId).all()

  return json({
    data: (result.results as any[]).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      courseId: row.course_id,
      courseTitle: row.course_title,
      courseStatus: row.course_status,
      studentId: row.student_id,
      studentName: row.student_name_snapshot ?? null,
      source: row.source,
      status: row.status,
      assessmentRequired: Number(row.quiz_enabled) === 1,
      minimumScore: Number(row.minimum_score ?? 0),
      activeCycleId: row.active_cycle_id ?? null,
      cycleNumber: row.cycle_number == null ? null : Number(row.cycle_number),
      cycleStatus: row.cycle_status ?? null,
      cycleSource: row.cycle_source ?? null,
      cycleStartedAt: row.cycle_started_at ?? null,
      cycleCompletedAt: row.cycle_completed_at ?? null,
      cycleDueAt: row.cycle_due_at ?? null,
      enrolledAt: row.enrolled_at,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
    })),
  })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const courseId = String(body.courseId ?? '').trim()
  const source = String(body.source ?? 'academy').trim() || 'academy'
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const course = await db.prepare(`
    SELECT id, title, status
    FROM academy_courses
    WHERE tenant_id=? AND id=?
    LIMIT 1
  `).bind(context.tenantId, courseId).first()
  if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  if (String(course.status) !== 'published') return json({ error: 'Somente curso publicado permite matrícula' }, 409)

  const existing = await db.prepare(`
    SELECT e.*, lc.cycle_number, lc.status AS cycle_status
    FROM academy_enrollments e
    LEFT JOIN academy_learning_cycles lc ON lc.tenant_id=e.tenant_id AND lc.id=e.active_cycle_id
    WHERE e.tenant_id=? AND e.course_id=? AND e.student_id=?
    LIMIT 1
  `).bind(context.tenantId, courseId, context.userId).first()

  if (existing && String(existing.status) !== 'cancelled') {
    return json({ data: {
      id: existing.id,
      courseId,
      studentId: context.userId,
      status: existing.status,
      activeCycleId: existing.active_cycle_id ?? null,
      cycleNumber: existing.cycle_number == null ? null : Number(existing.cycle_number),
      cycleStatus: existing.cycle_status ?? null,
      enrolledAt: existing.enrolled_at,
    }, idempotent: true })
  }

  const now = new Date().toISOString()
  const enrollmentId = existing ? String(existing.id) : crypto.randomUUID()
  const cycleId = crypto.randomUUID()
  const cycleNumber = await nextCycleNumber(db, context.tenantId, context.userId, courseId)
  const action = existing ? 'enrollment.reactivated' : 'enrollment.created'

  await db.batch([
    db.prepare(`
      INSERT INTO academy_enrollments (
        id, tenant_id, course_id, student_id, student_name_snapshot,
        source, status, enrolled_at, completed_at, updated_at, active_cycle_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NULL, ?, ?)
      ON CONFLICT(tenant_id, course_id, student_id) DO UPDATE SET
        student_name_snapshot=excluded.student_name_snapshot,
        source=excluded.source,
        status='active',
        enrolled_at=excluded.enrolled_at,
        completed_at=NULL,
        updated_at=excluded.updated_at,
        active_cycle_id=excluded.active_cycle_id
    `).bind(
      enrollmentId, context.tenantId, courseId, context.userId,
      context.displayName ?? null, source, now, now, cycleId,
    ),
    learningCycleInsertStatement(db, {
      id: cycleId,
      tenantId: context.tenantId,
      enrollmentId,
      studentId: context.userId,
      courseId,
      cycleNumber,
      source,
      startedAt: now,
    }),
    auditStatement(db, context, {
      action,
      resourceType: 'enrollment',
      resourceId: enrollmentId,
      metadata: { courseId, courseTitle: course.title, source, cycleId, cycleNumber },
    }),
  ])

  return json({ data: {
    id: enrollmentId,
    tenantId: context.tenantId,
    courseId,
    courseTitle: course.title,
    studentId: context.userId,
    studentName: context.displayName ?? null,
    source,
    status: 'active',
    activeCycleId: cycleId,
    cycleNumber,
    cycleStatus: 'active',
    enrolledAt: now,
    updatedAt: now,
  }, reactivated: Boolean(existing) }, existing ? 200 : 201)
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const courseId = new URL(request.url).searchParams.get('courseId')?.trim() ?? ''
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const enrollment = await db.prepare(`
    SELECT * FROM academy_enrollments
    WHERE tenant_id=? AND course_id=? AND student_id=? LIMIT 1
  `).bind(context.tenantId, courseId, context.userId).first()
  if (!enrollment) return json({ error: 'Matrícula não encontrada' }, 404)
  if (String(enrollment.status) === 'cancelled') return json({ data: { id: enrollment.id, courseId, status: 'cancelled' }, idempotent: true })

  const now = new Date().toISOString()
  const statements: any[] = [
    db.prepare(`UPDATE academy_enrollments SET status='cancelled', updated_at=? WHERE tenant_id=? AND course_id=? AND student_id=?`)
      .bind(now, context.tenantId, courseId, context.userId),
  ]
  if (enrollment.active_cycle_id) {
    statements.push(db.prepare(`
      UPDATE academy_learning_cycles
      SET status='cancelled', updated_at=?
      WHERE tenant_id=? AND id=? AND status='active'
    `).bind(now, context.tenantId, enrollment.active_cycle_id))
  }
  statements.push(auditStatement(db, context, {
    action: 'enrollment.cancelled', resourceType: 'enrollment', resourceId: String(enrollment.id),
    metadata: { courseId, cycleId: enrollment.active_cycle_id ?? null },
  }))
  await db.batch(statements)

  return json({ data: { id: enrollment.id, courseId, status: 'cancelled', updatedAt: now } })
}
