import { auditStatement } from './_audit'
import { ensureEnterpriseCourseAssignment } from './_enterpriseAssignment'
import { requireCompanyScope, requireEnterpriseContext } from './_enterpriseAuth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

function dueAt(value: unknown): string | null | undefined {
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
  const denied = requireCompanyScope(auth, companyId); if (denied) return denied

  const assignments = await db.prepare(`
    SELECT pa.*, p.name path_name, m.user_id, m.display_name_snapshot, m.job_title
    FROM academy_company_path_assignments pa
    JOIN academy_company_learning_paths p ON p.tenant_id=pa.tenant_id AND p.id=pa.path_id
    JOIN academy_company_members m ON m.tenant_id=pa.tenant_id AND m.id=pa.member_id
    WHERE pa.tenant_id=? AND pa.company_id=?
    ORDER BY pa.status='cancelled', pa.due_at IS NULL, pa.due_at, pa.assigned_at DESC
  `).bind(auth.tenantId, companyId).all()

  const links = await db.prepare(`
    SELECT link.path_assignment_id, pc.course_id, pc.required, pc.renewal_months,
      c.title course_title, e.status enrollment_status,
      COALESCE((SELECT ROUND(AVG(COALESCE(pr.progress_percent,0)))
        FROM academy_course_lessons l LEFT JOIN academy_progress pr
        ON pr.tenant_id=l.tenant_id AND pr.course_id=l.course_id AND pr.lesson_id=l.id AND pr.student_id=m.user_id
        WHERE l.tenant_id=ca.tenant_id AND l.course_id=ca.course_id AND l.required=1),0) progress_percent
    FROM academy_company_path_assignment_courses link
    JOIN academy_company_path_assignments pa ON pa.tenant_id=link.tenant_id AND pa.id=link.path_assignment_id
    JOIN academy_company_learning_path_courses pc ON pc.tenant_id=link.tenant_id AND pc.id=link.path_course_id
    JOIN academy_course_assignments ca ON ca.tenant_id=link.tenant_id AND ca.id=link.course_assignment_id
    JOIN academy_company_members m ON m.tenant_id=ca.tenant_id AND m.id=ca.member_id
    JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id
    LEFT JOIN academy_enrollments e ON e.tenant_id=ca.tenant_id AND e.course_id=ca.course_id AND e.student_id=m.user_id
    WHERE link.tenant_id=? AND link.company_id=?
    ORDER BY link.path_assignment_id, pc.position
  `).bind(auth.tenantId, companyId).all()

  const byPath = new Map<string, any[]>()
  for (const row of links.results as any[]) {
    const list = byPath.get(String(row.path_assignment_id)) ?? []
    const completed = String(row.enrollment_status ?? '') === 'completed'
    list.push({ courseId: row.course_id, courseTitle: row.course_title, required: Number(row.required) === 1,
      renewalMonths: row.renewal_months == null ? null : Number(row.renewal_months),
      progressPercent: completed ? 100 : Math.max(0, Math.min(100, Number(row.progress_percent ?? 0))), completed })
    byPath.set(String(row.path_assignment_id), list)
  }

  const now = Date.now()
  return json({ data: (assignments.results as any[]).map((row) => {
    const courses = byPath.get(String(row.id)) ?? []
    const required = courses.filter((item) => item.required)
    const completedCount = required.filter((item) => item.completed).length
    const complete = required.length > 0 && completedCount === required.length
    const progress = required.length ? Math.round(required.reduce((sum, item) => sum + item.progressPercent, 0) / required.length) : 0
    const cancelled = String(row.status) === 'cancelled'
    const overdue = !cancelled && !complete && row.due_at && new Date(String(row.due_at)).getTime() < now
    return { id: row.id, companyId: row.company_id, pathId: row.path_id, pathName: row.path_name,
      memberId: row.member_id, userId: row.user_id, displayName: row.display_name_snapshot, jobTitle: row.job_title ?? null,
      status: row.status, effectiveStatus: cancelled ? 'cancelled' : complete ? 'completed' : progress > 0 ? 'in_progress' : 'assigned',
      dueAt: row.due_at ?? null, overdue: Boolean(overdue), progressPercent: progress,
      completedCourses: completedCount, requiredCourses: required.length, courses, assignedAt: row.assigned_at }
  }) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const companyId = String(body.companyId ?? '').trim(), pathId = String(body.pathId ?? '').trim(), memberId = String(body.memberId ?? '').trim()
  const normalizedDueAt = dueAt(body.dueAt)
  if (!companyId || !pathId || !memberId) return json({ error: 'companyId, pathId e memberId são obrigatórios' }, 400)
  if (normalizedDueAt === undefined) return json({ error: 'dueAt inválido' }, 400)
  const denied = requireCompanyScope(auth, companyId); if (denied) return denied

  const path = await db.prepare(`SELECT * FROM academy_company_learning_paths WHERE tenant_id=? AND company_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId, companyId, pathId).first()
  const member = await db.prepare(`SELECT * FROM academy_company_members WHERE tenant_id=? AND company_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId, companyId, memberId).first()
  if (!path || String(path.status) !== 'active') return json({ error: 'Trilha ativa não encontrada nesta empresa/tenant' }, 404)
  if (!member || String(member.status) !== 'active') return json({ error: 'Colaborador ativo não encontrado nesta empresa/tenant' }, 404)

  const existing = await db.prepare(`SELECT * FROM academy_company_path_assignments WHERE tenant_id=? AND company_id=? AND path_id=? AND member_id=? AND status IN ('assigned','in_progress') LIMIT 1`)
    .bind(auth.tenantId, companyId, pathId, memberId).first()
  if (existing) return json({ data: { id: existing.id, companyId, pathId, memberId, status: existing.status }, idempotent: true })

  const pathCourses = await db.prepare(`SELECT pc.*, c.status course_status FROM academy_company_learning_path_courses pc JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id WHERE pc.tenant_id=? AND pc.company_id=? AND pc.path_id=? ORDER BY pc.position`)
    .bind(auth.tenantId, companyId, pathId).all()
  if (!(pathCourses.results as any[]).length) return json({ error: 'Trilha não possui cursos' }, 409)
  if ((pathCourses.results as any[]).some((row) => String(row.course_status) !== 'published')) return json({ error: 'Todos os cursos da trilha precisam estar publicados' }, 409)

  const pathAssignmentId = crypto.randomUUID(), now = new Date().toISOString(), statements: any[] = []
  let allRequiredCompleted = true
  statements.push(db.prepare(`INSERT INTO academy_company_path_assignments (id,tenant_id,company_id,path_id,member_id,status,due_at,assigned_by,assigned_at,completed_at,updated_at) VALUES (?,?,?,?,?,'assigned',?,?,?,NULL,?)`)
    .bind(pathAssignmentId, auth.tenantId, companyId, pathId, memberId, normalizedDueAt, auth.userId, now, now))

  for (const row of pathCourses.results as any[]) {
    const assignment = await ensureEnterpriseCourseAssignment(db, { tenantId: auth.tenantId, companyId, member: member as any,
      courseId: String(row.course_id), required: Number(row.required) === 1, dueAt: normalizedDueAt,
      renewalMonths: row.renewal_months ?? path.default_renewal_months ?? null,
      source: `company_path:${pathAssignmentId}`, actorId: auth.userId, now })
    statements.push(...assignment.statements)
    if (Number(row.required) === 1 && !assignment.completed) allRequiredCompleted = false
    statements.push(db.prepare(`INSERT INTO academy_company_path_assignment_courses (id,tenant_id,company_id,path_assignment_id,path_course_id,course_assignment_id,created_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), auth.tenantId, companyId, pathAssignmentId, row.id, assignment.id, now))
  }

  if (allRequiredCompleted) statements.push(db.prepare(`UPDATE academy_company_path_assignments SET status='completed',completed_at=?,updated_at=? WHERE tenant_id=? AND id=?`).bind(now, now, auth.tenantId, pathAssignmentId))
  statements.push(auditStatement(db, auth, { action: 'company_learning_path.assigned', resourceType: 'company_path_assignment', resourceId: pathAssignmentId,
    metadata: { companyId, pathId, pathName: path.name, memberId, userId: member.user_id, dueAt: normalizedDueAt } }))
  await db.batch(statements)
  return json({ data: { id: pathAssignmentId, companyId, pathId, pathName: path.name, memberId, userId: member.user_id,
    displayName: member.display_name_snapshot, status: allRequiredCompleted ? 'completed' : 'assigned', dueAt: normalizedDueAt, assignedAt: now } }, 201)
}
