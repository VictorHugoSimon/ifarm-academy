import { auditStatement } from './_audit'
import { ensureEnterpriseCourseAssignment } from './_enterpriseAssignment'
import { requireCompanyScope, requireEnterpriseContext } from './_enterpriseAuth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

function normalizeDueAt(value: unknown): string | null | undefined {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  const date = new Date(raw)
  if (!raw || Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? ''
  if (!companyId) return json({ error: 'companyId é obrigatório' }, 400)
  const scopeDenied = requireCompanyScope(auth, companyId)
  if (scopeDenied) return scopeDenied

  const company = await db.prepare('SELECT id FROM academy_companies WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, companyId).first()
  if (!company) return json({ error: 'Empresa não encontrada neste tenant' }, 404)

  const result = await db.prepare(`
    SELECT
      a.*,
      m.user_id,
      m.display_name_snapshot,
      m.employee_code,
      m.job_title,
      c.title AS course_title,
      lc.cycle_number,
      lc.status AS cycle_status,
      lc.started_at AS cycle_started_at,
      lc.completed_at AS cycle_completed_at,
      cert.public_code AS certificate_code,
      cert.status AS certificate_status,
      COALESCE((
        SELECT ROUND(AVG(COALESCE(p.progress_percent, 0)))
        FROM academy_course_lessons l
        LEFT JOIN academy_progress p
          ON p.tenant_id=l.tenant_id AND p.course_id=l.course_id
          AND p.lesson_id=l.id AND p.student_id=m.user_id
          AND p.cycle_id=a.learning_cycle_id
        WHERE l.tenant_id=a.tenant_id AND l.course_id=a.course_id AND l.required=1
      ), 0) AS progress_percent
    FROM academy_course_assignments a
    JOIN academy_company_members m
      ON m.tenant_id=a.tenant_id AND m.company_id=a.company_id AND m.id=a.member_id
    JOIN academy_courses c
      ON c.tenant_id=a.tenant_id AND c.id=a.course_id
    LEFT JOIN academy_learning_cycles lc
      ON lc.tenant_id=a.tenant_id AND lc.id=a.learning_cycle_id
    LEFT JOIN academy_certificates cert
      ON cert.tenant_id=a.tenant_id AND cert.course_id=a.course_id
      AND cert.student_id=m.user_id AND cert.cycle_id=a.learning_cycle_id
    WHERE a.tenant_id=? AND a.company_id=?
    ORDER BY a.status='cancelled', a.due_at IS NULL, a.due_at, a.assigned_at DESC
  `).bind(auth.tenantId, companyId).all()

  const now = Date.now()
  return json({ data: (result.results as any[]).map((row) => {
    const progressPercent = Math.max(0, Math.min(100, Number(row.progress_percent ?? 0)))
    const completed = String(row.status) === 'completed' || String(row.cycle_status ?? '') === 'completed'
    const cancelled = String(row.status) === 'cancelled'
    const started = !completed && progressPercent > 0
    const dueMs = row.due_at ? new Date(String(row.due_at)).getTime() : Number.NaN
    const overdue = !cancelled && !completed && Number.isFinite(dueMs) && dueMs < now
    return {
      id: row.id,
      companyId: row.company_id,
      memberId: row.member_id,
      userId: row.user_id,
      displayName: row.display_name_snapshot,
      employeeCode: row.employee_code ?? null,
      jobTitle: row.job_title ?? null,
      courseId: row.course_id,
      courseTitle: row.course_title,
      learningCycleId: row.learning_cycle_id ?? null,
      learningCycleNumber: row.cycle_number == null ? null : Number(row.cycle_number),
      required: Number(row.required) === 1,
      dueAt: row.due_at ?? null,
      status: row.status,
      effectiveStatus: cancelled ? 'cancelled' : completed ? 'completed' : started ? 'in_progress' : 'assigned',
      progressPercent: completed ? 100 : progressPercent,
      overdue,
      certificateCode: row.certificate_code ?? null,
      certificateStatus: row.certificate_status ?? null,
      renewalMonths: row.renewal_months == null ? null : Number(row.renewal_months),
      renewalCycle: Number(row.renewal_cycle ?? 1),
      assignedAt: row.assigned_at,
      completedAt: row.completed_at ?? row.cycle_completed_at ?? null,
      updatedAt: row.updated_at,
    }
  }) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const companyId = String(body.companyId ?? '').trim()
  const memberId = String(body.memberId ?? '').trim()
  const courseId = String(body.courseId ?? '').trim()
  const required = body.required !== false
  const dueAt = normalizeDueAt(body.dueAt)
  if (!companyId || !memberId || !courseId) return json({ error: 'companyId, memberId e courseId são obrigatórios' }, 400)
  if (dueAt === undefined) return json({ error: 'dueAt inválido' }, 400)
  const scopeDenied = requireCompanyScope(auth, companyId)
  if (scopeDenied) return scopeDenied

  const company = await db.prepare(`SELECT id, status FROM academy_companies WHERE tenant_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId, companyId).first()
  if (!company) return json({ error: 'Empresa não encontrada neste tenant' }, 404)
  if (String(company.status) !== 'active') return json({ error: 'Empresa inativa não permite novas atribuições' }, 409)

  const member = await db.prepare(`SELECT * FROM academy_company_members WHERE tenant_id=? AND company_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId, companyId, memberId).first()
  if (!member) return json({ error: 'Colaborador não encontrado nesta empresa/tenant' }, 404)
  if (String(member.status) !== 'active') return json({ error: 'Colaborador inativo não permite nova atribuição' }, 409)

  const course = await db.prepare(`SELECT id, title, status FROM academy_courses WHERE tenant_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId, courseId).first()
  if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  if (String(course.status) !== 'published') return json({ error: 'Somente curso publicado pode ser atribuído' }, 409)

  const now = new Date().toISOString()
  const assignment = await ensureEnterpriseCourseAssignment(db, {
    tenantId: auth.tenantId,
    companyId,
    member: member as any,
    courseId,
    required,
    dueAt,
    renewalMonths: null,
    source: `company_assignment:${companyId}`,
    actorId: auth.userId,
    now,
  })

  if (assignment.existing && !assignment.statements.length) {
    return json({ data: {
      id: assignment.id,
      companyId,
      memberId,
      courseId,
      learningCycleId: assignment.learningCycleId ?? null,
      status: assignment.completed ? 'completed' : 'assigned',
      dueAt,
    }, idempotent: true })
  }

  await db.batch([
    ...assignment.statements,
    auditStatement(db, auth, {
      action: assignment.existing ? 'company_course.assignment_reconciled' : 'company_course.assigned',
      resourceType: 'course_assignment',
      resourceId: assignment.id,
      metadata: {
        companyId,
        memberId,
        userId: member.user_id,
        courseId,
        courseTitle: course.title,
        required,
        dueAt,
        learningCycleId: assignment.learningCycleId ?? null,
      },
    }),
  ])

  return json({ data: {
    id: assignment.id,
    companyId,
    memberId,
    userId: member.user_id,
    displayName: member.display_name_snapshot,
    courseId,
    courseTitle: course.title,
    learningCycleId: assignment.learningCycleId ?? null,
    learningCycleNumber: assignment.learningCycleNumber ?? null,
    required,
    dueAt,
    status: assignment.completed ? 'completed' : 'assigned',
    effectiveStatus: assignment.completed ? 'completed' : 'assigned',
    progressPercent: assignment.completed ? 100 : 0,
    overdue: false,
    assignedAt: now,
    completedAt: assignment.completed ? now : null,
    updatedAt: now,
  }, idempotent: assignment.existing }, assignment.existing ? 200 : 201)
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const assignmentId = new URL(request.url).searchParams.get('assignmentId')?.trim() ?? ''
  if (!assignmentId) return json({ error: 'assignmentId é obrigatório' }, 400)

  const assignment = await db.prepare(`SELECT * FROM academy_course_assignments WHERE tenant_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId, assignmentId).first()
  if (!assignment) return json({ error: 'Atribuição não encontrada neste tenant' }, 404)
  const scopeDenied = requireCompanyScope(auth, String(assignment.company_id))
  if (scopeDenied) return scopeDenied
  if (String(assignment.status) === 'cancelled') return json({ data: { id: assignmentId, status: 'cancelled' }, idempotent: true })

  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`UPDATE academy_course_assignments SET status='cancelled', updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(now, auth.tenantId, assignmentId),
    auditStatement(db, auth, {
      action: 'company_course.assignment_cancelled',
      resourceType: 'course_assignment',
      resourceId: assignmentId,
      metadata: { companyId: assignment.company_id, memberId: assignment.member_id, courseId: assignment.course_id, learningCycleId: assignment.learning_cycle_id ?? null },
    }),
  ])

  // A matrícula/ciclo não é cancelada automaticamente: o aluno pode ter direito por outra origem.
  return json({ data: { id: assignmentId, status: 'cancelled', updatedAt: now } })
}
