import { auditStatement } from './_audit'
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

  const url = new URL(request.url)
  const companyId = url.searchParams.get('companyId')?.trim() ?? ''
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
      e.status AS enrollment_status,
      e.completed_at AS enrollment_completed_at,
      cert.public_code AS certificate_code,
      cert.status AS certificate_status,
      COALESCE((
        SELECT ROUND(AVG(COALESCE(p.progress_percent, 0)))
        FROM academy_course_lessons l
        LEFT JOIN academy_progress p
          ON p.tenant_id=l.tenant_id AND p.course_id=l.course_id
          AND p.lesson_id=l.id AND p.student_id=m.user_id
        WHERE l.tenant_id=a.tenant_id AND l.course_id=a.course_id AND l.required=1
      ), 0) AS progress_percent
    FROM academy_course_assignments a
    JOIN academy_company_members m
      ON m.tenant_id=a.tenant_id AND m.company_id=a.company_id AND m.id=a.member_id
    JOIN academy_courses c
      ON c.tenant_id=a.tenant_id AND c.id=a.course_id
    LEFT JOIN academy_enrollments e
      ON e.tenant_id=a.tenant_id AND e.course_id=a.course_id AND e.student_id=m.user_id
    LEFT JOIN academy_certificates cert
      ON cert.tenant_id=a.tenant_id AND cert.course_id=a.course_id
      AND cert.student_id=m.user_id AND cert.status='valid'
    WHERE a.tenant_id=? AND a.company_id=?
    ORDER BY a.status='cancelled', a.due_at IS NULL, a.due_at, a.assigned_at DESC
  `).bind(auth.tenantId, companyId).all()

  const now = Date.now()
  return json({ data: (result.results as any[]).map((row) => {
    const progressPercent = Math.max(0, Math.min(100, Number(row.progress_percent ?? 0)))
    const completed = String(row.enrollment_status ?? '') === 'completed'
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
      required: Number(row.required) === 1,
      dueAt: row.due_at ?? null,
      status: row.status,
      effectiveStatus: cancelled ? 'cancelled' : completed ? 'completed' : started ? 'in_progress' : 'assigned',
      progressPercent,
      overdue,
      certificateCode: row.certificate_code ?? null,
      certificateStatus: row.certificate_status ?? null,
      assignedAt: row.assigned_at,
      completedAt: row.enrollment_completed_at ?? row.completed_at ?? null,
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

  const member = await db.prepare(`
    SELECT * FROM academy_company_members
    WHERE tenant_id=? AND company_id=? AND id=? LIMIT 1
  `).bind(auth.tenantId, companyId, memberId).first()
  if (!member) return json({ error: 'Colaborador não encontrado nesta empresa/tenant' }, 404)
  if (String(member.status) !== 'active') return json({ error: 'Colaborador inativo não permite nova atribuição' }, 409)

  const course = await db.prepare(`SELECT id, title, status FROM academy_courses WHERE tenant_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId, courseId).first()
  if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  if (String(course.status) !== 'published') return json({ error: 'Somente curso publicado pode ser atribuído' }, 409)

  const existing = await db.prepare(`
    SELECT * FROM academy_course_assignments
    WHERE tenant_id=? AND company_id=? AND member_id=? AND course_id=? AND status!='cancelled'
    LIMIT 1
  `).bind(auth.tenantId, companyId, memberId, courseId).first()
  if (existing) {
    return json({ data: { id: existing.id, companyId, memberId, courseId, status: existing.status, dueAt: existing.due_at ?? null }, idempotent: true })
  }

  const enrollment = await db.prepare(`
    SELECT * FROM academy_enrollments
    WHERE tenant_id=? AND course_id=? AND student_id=? LIMIT 1
  `).bind(auth.tenantId, courseId, member.user_id).first()

  const assignmentId = crypto.randomUUID()
  const enrollmentId = enrollment ? String(enrollment.id) : crypto.randomUUID()
  const now = new Date().toISOString()
  const source = `company_assignment:${companyId}`
  const alreadyCompleted = String(enrollment?.status ?? '') === 'completed'

  await db.batch([
    db.prepare(`
      INSERT INTO academy_enrollments (
        id, tenant_id, course_id, student_id, student_name_snapshot,
        source, status, enrolled_at, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, course_id, student_id) DO UPDATE SET
        student_name_snapshot=excluded.student_name_snapshot,
        source=excluded.source,
        status=CASE WHEN academy_enrollments.status='completed' THEN 'completed' ELSE 'active' END,
        completed_at=CASE WHEN academy_enrollments.status='completed' THEN academy_enrollments.completed_at ELSE NULL END,
        updated_at=excluded.updated_at
    `).bind(
      enrollmentId,
      auth.tenantId,
      courseId,
      member.user_id,
      member.display_name_snapshot,
      source,
      alreadyCompleted ? 'completed' : 'active',
      enrollment?.enrolled_at ?? now,
      alreadyCompleted ? enrollment.completed_at : null,
      now,
    ),
    db.prepare(`
      INSERT INTO academy_course_assignments (
        id, tenant_id, company_id, member_id, course_id, required, due_at,
        status, source, assigned_by, assigned_at, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'company_admin', ?, ?, ?, ?)
    `).bind(
      assignmentId,
      auth.tenantId,
      companyId,
      memberId,
      courseId,
      required ? 1 : 0,
      dueAt,
      alreadyCompleted ? 'completed' : 'assigned',
      auth.userId,
      now,
      alreadyCompleted ? enrollment.completed_at ?? now : null,
      now,
    ),
    auditStatement(db, auth, {
      action: 'company_course.assigned',
      resourceType: 'course_assignment',
      resourceId: assignmentId,
      metadata: { companyId, memberId, userId: member.user_id, courseId, courseTitle: course.title, required, dueAt },
    }),
  ])

  return json({ data: {
    id: assignmentId,
    companyId,
    memberId,
    userId: member.user_id,
    displayName: member.display_name_snapshot,
    courseId,
    courseTitle: course.title,
    required,
    dueAt,
    status: alreadyCompleted ? 'completed' : 'assigned',
    effectiveStatus: alreadyCompleted ? 'completed' : 'assigned',
    progressPercent: alreadyCompleted ? 100 : 0,
    overdue: false,
    assignedAt: now,
    completedAt: alreadyCompleted ? enrollment.completed_at ?? now : null,
    updatedAt: now,
  } }, 201)
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const assignmentId = new URL(request.url).searchParams.get('assignmentId')?.trim() ?? ''
  if (!assignmentId) return json({ error: 'assignmentId é obrigatório' }, 400)

  const assignment = await db.prepare(`
    SELECT * FROM academy_course_assignments
    WHERE tenant_id=? AND id=? LIMIT 1
  `).bind(auth.tenantId, assignmentId).first()
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
      metadata: { companyId: assignment.company_id, memberId: assignment.member_id, courseId: assignment.course_id },
    }),
  ])

  // A matrícula não é cancelada automaticamente: o aluno pode ter direito ao curso por outra origem.
  return json({ data: { id: assignmentId, status: 'cancelled', updatedAt: now } })
}
