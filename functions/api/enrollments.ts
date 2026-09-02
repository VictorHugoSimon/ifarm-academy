import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
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
      c.minimum_score
    FROM academy_enrollments e
    JOIN academy_courses c
      ON c.tenant_id=e.tenant_id AND c.id=e.course_id
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
    SELECT * FROM academy_enrollments
    WHERE tenant_id=? AND course_id=? AND student_id=?
    LIMIT 1
  `).bind(context.tenantId, courseId, context.userId).first()

  const now = new Date().toISOString()
  if (existing && String(existing.status) !== 'cancelled') {
    return json({
      data: {
        id: existing.id,
        courseId,
        studentId: context.userId,
        status: existing.status,
        enrolledAt: existing.enrolled_at,
      },
      idempotent: true,
    })
  }

  const id = existing ? String(existing.id) : crypto.randomUUID()
  const action = existing ? 'enrollment.reactivated' : 'enrollment.created'

  await db.batch([
    db.prepare(`
      INSERT INTO academy_enrollments (
        id, tenant_id, course_id, student_id, student_name_snapshot,
        source, status, enrolled_at, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NULL, ?)
      ON CONFLICT(tenant_id, course_id, student_id) DO UPDATE SET
        student_name_snapshot=excluded.student_name_snapshot,
        source=excluded.source,
        status='active',
        enrolled_at=excluded.enrolled_at,
        completed_at=NULL,
        updated_at=excluded.updated_at
    `).bind(
      id,
      context.tenantId,
      courseId,
      context.userId,
      context.displayName ?? null,
      source,
      now,
      now,
    ),
    auditStatement(db, context, {
      action,
      resourceType: 'enrollment',
      resourceId: id,
      metadata: { courseId, courseTitle: course.title, source },
    }),
  ])

  return json({
    data: {
      id,
      tenantId: context.tenantId,
      courseId,
      courseTitle: course.title,
      studentId: context.userId,
      studentName: context.displayName ?? null,
      source,
      status: 'active',
      enrolledAt: now,
      updatedAt: now,
    },
    reactivated: Boolean(existing),
  }, existing ? 200 : 201)
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const url = new URL(request.url)
  const courseId = url.searchParams.get('courseId')?.trim() ?? ''
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const enrollment = await db.prepare(`
    SELECT * FROM academy_enrollments
    WHERE tenant_id=? AND course_id=? AND student_id=?
    LIMIT 1
  `).bind(context.tenantId, courseId, context.userId).first()

  if (!enrollment) return json({ error: 'Matrícula não encontrada' }, 404)
  if (String(enrollment.status) === 'cancelled') {
    return json({ data: { id: enrollment.id, courseId, status: 'cancelled' }, idempotent: true })
  }

  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`
      UPDATE academy_enrollments
      SET status='cancelled', updated_at=?
      WHERE tenant_id=? AND course_id=? AND student_id=?
    `).bind(now, context.tenantId, courseId, context.userId),
    auditStatement(db, context, {
      action: 'enrollment.cancelled',
      resourceType: 'enrollment',
      resourceId: String(enrollment.id),
      metadata: { courseId },
    }),
  ])

  return json({ data: { id: enrollment.id, courseId, status: 'cancelled', updatedAt: now } })
}
