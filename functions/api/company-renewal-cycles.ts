import { auditStatement } from './_audit'
import { learningCycleInsertStatement, nextCycleNumber } from './_cycle'
import { requireCompanyScope, requireEnterpriseContext } from './_enterpriseAuth'
import { evaluateRenewal } from './_renewal'
import { bodyJson, dbOr503, json, type Env } from './_shared'

function normalizeDueAt(value: unknown): string | null | undefined {
  if (value == null || value === '') return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? ''
  if (!companyId) return json({ error: 'companyId é obrigatório' }, 400)
  const denied = requireCompanyScope(auth, companyId)
  if (denied) return denied

  const result = await db.prepare(`
    SELECT
      lc.id, lc.student_id, lc.course_id, lc.cycle_number, lc.status,
      lc.source, lc.renewal_of_cycle_id, lc.due_at, lc.started_at, lc.completed_at,
      m.display_name_snapshot, m.job_title, c.title AS course_title,
      a.id AS assignment_id, a.renewal_cycle, a.renewal_months
    FROM academy_learning_cycles lc
    JOIN academy_company_members m
      ON m.tenant_id=lc.tenant_id AND m.company_id=lc.company_id AND m.id=lc.member_id
    JOIN academy_courses c
      ON c.tenant_id=lc.tenant_id AND c.id=lc.course_id
    LEFT JOIN academy_course_assignments a
      ON a.tenant_id=lc.tenant_id AND a.learning_cycle_id=lc.id
    WHERE lc.tenant_id=? AND lc.company_id=?
    ORDER BY lc.student_id, lc.course_id, lc.cycle_number DESC
  `).bind(auth.tenantId, companyId).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id,
    studentId: row.student_id,
    displayName: row.display_name_snapshot,
    jobTitle: row.job_title ?? null,
    courseId: row.course_id,
    courseTitle: row.course_title,
    cycleNumber: Number(row.cycle_number),
    status: row.status,
    source: row.source,
    renewalOfCycleId: row.renewal_of_cycle_id ?? null,
    dueAt: row.due_at ?? null,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    assignmentId: row.assignment_id ?? null,
    renewalCycle: row.renewal_cycle == null ? null : Number(row.renewal_cycle),
    renewalMonths: row.renewal_months == null ? null : Number(row.renewal_months),
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const assignmentId = String(body.assignmentId ?? '').trim()
  const dueAt = normalizeDueAt(body.dueAt)
  if (!assignmentId) return json({ error: 'assignmentId é obrigatório' }, 400)
  if (dueAt === undefined) return json({ error: 'dueAt inválido' }, 400)

  const previous = await db.prepare(`
    SELECT
      a.*, m.user_id, m.display_name_snapshot, m.status AS member_status,
      c.title AS course_title, c.status AS course_status,
      e.id AS enrollment_id, e.active_cycle_id, e.status AS enrollment_status,
      lc.status AS cycle_status, lc.completed_at AS cycle_completed_at, lc.cycle_number
    FROM academy_course_assignments a
    JOIN academy_company_members m
      ON m.tenant_id=a.tenant_id AND m.company_id=a.company_id AND m.id=a.member_id
    JOIN academy_courses c
      ON c.tenant_id=a.tenant_id AND c.id=a.course_id
    JOIN academy_enrollments e
      ON e.tenant_id=a.tenant_id AND e.course_id=a.course_id AND e.student_id=m.user_id
    LEFT JOIN academy_learning_cycles lc
      ON lc.tenant_id=a.tenant_id AND lc.id=a.learning_cycle_id
    WHERE a.tenant_id=? AND a.id=?
    LIMIT 1
  `).bind(auth.tenantId, assignmentId).first()

  if (!previous) return json({ error: 'Atribuição concluída não encontrada neste tenant' }, 404)
  const companyId = String(previous.company_id)
  const denied = requireCompanyScope(auth, companyId)
  if (denied) return denied
  if (String(previous.status) !== 'completed') return json({ error: 'Somente atribuição concluída pode originar renovação' }, 409)
  if (String(previous.member_status) !== 'active') return json({ error: 'Colaborador inativo não permite novo ciclo' }, 409)
  if (String(previous.course_status) !== 'published') return json({ error: 'Curso precisa estar publicado para novo ciclo' }, 409)

  const renewalMonths = previous.renewal_months == null ? null : Number(previous.renewal_months)
  if (!renewalMonths) return json({ error: 'Periodicidade de renovação não configurada nesta atribuição' }, 409)
  const completedAt = String(previous.completed_at ?? previous.cycle_completed_at ?? '').trim()
  const renewal = evaluateRenewal(completedAt, renewalMonths)
  if (!['due', 'upcoming'].includes(renewal.state)) {
    return json({ error: 'Renovação ainda não está na janela permitida', renewal }, 409)
  }

  const oldCycleId = String(previous.learning_cycle_id ?? previous.active_cycle_id ?? '').trim()
  if (!oldCycleId || String(previous.cycle_status ?? '') !== 'completed') {
    return json({ error: 'Ciclo acadêmico anterior não está concluído de forma auditável' }, 409)
  }
  if (String(previous.active_cycle_id ?? '') !== oldCycleId || String(previous.enrollment_status) !== 'completed') {
    return json({ error: 'Já existe outro ciclo atual para esta matrícula' }, 409)
  }

  const openAssignment = await db.prepare(`
    SELECT id FROM academy_course_assignments
    WHERE tenant_id=? AND company_id=? AND member_id=? AND course_id=?
      AND status IN ('assigned','in_progress')
    LIMIT 1
  `).bind(auth.tenantId, companyId, previous.member_id, previous.course_id).first()
  if (openAssignment) return json({ error: 'Já existe um ciclo corporativo aberto para este curso/colaborador', assignmentId: openAssignment.id }, 409)

  const now = new Date().toISOString()
  const cycleId = crypto.randomUUID()
  const cycleNumber = await nextCycleNumber(db, auth.tenantId, String(previous.user_id), String(previous.course_id))
  const newAssignmentId = crypto.randomUUID()
  const renewalCycle = Math.max(Number(previous.renewal_cycle ?? 1) + 1, cycleNumber)
  const source = `company_renewal:${assignmentId}`

  await db.batch([
    learningCycleInsertStatement(db, {
      id: cycleId,
      tenantId: auth.tenantId,
      enrollmentId: String(previous.enrollment_id),
      studentId: String(previous.user_id),
      courseId: String(previous.course_id),
      cycleNumber,
      source,
      companyId,
      memberId: String(previous.member_id),
      renewalOfCycleId: oldCycleId,
      dueAt,
      startedAt: now,
    }),
    db.prepare(`
      UPDATE academy_enrollments
      SET status='active', source=?, completed_at=NULL, updated_at=?, active_cycle_id=?
      WHERE tenant_id=? AND id=? AND active_cycle_id=?
    `).bind(source, now, cycleId, auth.tenantId, previous.enrollment_id, oldCycleId),
    db.prepare(`
      INSERT INTO academy_course_assignments (
        id, tenant_id, company_id, member_id, course_id, required, due_at,
        status, source, assigned_by, assigned_at, completed_at, updated_at,
        renewal_months, renewal_of_assignment_id, renewal_cycle, learning_cycle_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'assigned', ?, ?, ?, NULL, ?, ?, ?, ?, ?)
    `).bind(
      newAssignmentId, auth.tenantId, companyId, previous.member_id, previous.course_id,
      Number(previous.required) === 1 ? 1 : 0, dueAt, source, auth.userId, now, now,
      renewalMonths, assignmentId, renewalCycle, cycleId,
    ),
    auditStatement(db, auth, {
      action: 'company_training.renewal_cycle_started',
      resourceType: 'learning_cycle',
      resourceId: cycleId,
      metadata: {
        companyId,
        memberId: previous.member_id,
        studentId: previous.user_id,
        courseId: previous.course_id,
        courseTitle: previous.course_title,
        previousAssignmentId: assignmentId,
        previousCycleId: oldCycleId,
        newAssignmentId,
        cycleNumber,
        renewalCycle,
        renewalMonths,
        renewalDueAt: renewal.renewalDueAt,
        dueAt,
      },
    }),
  ])

  return json({ data: {
    assignmentId: newAssignmentId,
    previousAssignmentId: assignmentId,
    cycleId,
    previousCycleId: oldCycleId,
    cycleNumber,
    renewalCycle,
    companyId,
    memberId: previous.member_id,
    studentId: previous.user_id,
    courseId: previous.course_id,
    courseTitle: previous.course_title,
    status: 'assigned',
    dueAt,
    startedAt: now,
    cleanState: { progressRows: 0, attempts: 0, certificates: 0 },
  } }, 201)
}
