export interface EnterpriseMemberRow {
  id: string
  user_id: string
  display_name_snapshot: string
}

export interface EnsureAssignmentInput {
  tenantId: string
  companyId: string
  member: EnterpriseMemberRow
  courseId: string
  required: boolean
  dueAt: string | null
  renewalMonths: number | null
  source: string
  actorId: string
  now: string
}

function earlierDate(current: unknown, candidate: string | null): string | null {
  const currentValue = current == null ? null : String(current)
  if (!candidate) return currentValue
  if (!currentValue) return candidate
  const currentMs = new Date(currentValue).getTime()
  const candidateMs = new Date(candidate).getTime()
  if (!Number.isFinite(currentMs)) return candidate
  if (!Number.isFinite(candidateMs)) return currentValue
  return candidateMs < currentMs ? candidate : currentValue
}

export async function ensureEnterpriseCourseAssignment(db: any, input: EnsureAssignmentInput) {
  const existing = await db.prepare(`
    SELECT * FROM academy_course_assignments
    WHERE tenant_id=? AND company_id=? AND member_id=? AND course_id=? AND status!='cancelled'
    ORDER BY status IN ('assigned','in_progress') DESC, completed_at DESC, assigned_at DESC
    LIMIT 1
  `).bind(input.tenantId, input.companyId, input.member.id, input.courseId).first()

  const enrollment = await db.prepare(`
    SELECT * FROM academy_enrollments
    WHERE tenant_id=? AND course_id=? AND student_id=? LIMIT 1
  `).bind(input.tenantId, input.courseId, input.member.user_id).first()
  const completed = String(enrollment?.status ?? '') === 'completed'

  if (existing) {
    const statements: any[] = []
    if (['assigned', 'in_progress'].includes(String(existing.status))) {
      const stricterDueAt = earlierDate(existing.due_at, input.dueAt)
      const nextRequired = Number(existing.required) === 1 || input.required ? 1 : 0
      const nextRenewal = existing.renewal_months ?? input.renewalMonths
      if (
        stricterDueAt !== (existing.due_at ?? null) ||
        nextRequired !== Number(existing.required) ||
        nextRenewal !== existing.renewal_months
      ) {
        statements.push(db.prepare(`
          UPDATE academy_course_assignments
          SET due_at=?, required=?, renewal_months=?, updated_at=?
          WHERE tenant_id=? AND id=?
        `).bind(stricterDueAt, nextRequired, nextRenewal, input.now, input.tenantId, existing.id))
      }
    }
    return { id: String(existing.id), completed, existing: true, statements }
  }

  const assignmentId = crypto.randomUUID()
  const enrollmentId = enrollment ? String(enrollment.id) : crypto.randomUUID()
  const previousCycle = await db.prepare(`
    SELECT MAX(renewal_cycle) AS cycle FROM academy_course_assignments
    WHERE tenant_id=? AND company_id=? AND member_id=? AND course_id=?
  `).bind(input.tenantId, input.companyId, input.member.id, input.courseId).first()
  const cycle = Math.max(1, Number(previousCycle?.cycle ?? 0) + 1)

  const statements = [
    db.prepare(`
      INSERT INTO academy_enrollments (
        id, tenant_id, course_id, student_id, student_name_snapshot,
        source, status, enrolled_at, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, course_id, student_id) DO UPDATE SET
        student_name_snapshot=excluded.student_name_snapshot,
        status=CASE WHEN academy_enrollments.status='completed' THEN 'completed' ELSE 'active' END,
        completed_at=CASE WHEN academy_enrollments.status='completed' THEN academy_enrollments.completed_at ELSE NULL END,
        updated_at=excluded.updated_at
    `).bind(
      enrollmentId,
      input.tenantId,
      input.courseId,
      input.member.user_id,
      input.member.display_name_snapshot,
      input.source,
      completed ? 'completed' : 'active',
      enrollment?.enrolled_at ?? input.now,
      completed ? enrollment.completed_at : null,
      input.now,
    ),
    db.prepare(`
      INSERT INTO academy_course_assignments (
        id, tenant_id, company_id, member_id, course_id, required, due_at,
        status, source, assigned_by, assigned_at, completed_at, updated_at,
        renewal_months, renewal_cycle
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      assignmentId,
      input.tenantId,
      input.companyId,
      input.member.id,
      input.courseId,
      input.required ? 1 : 0,
      input.dueAt,
      completed ? 'completed' : 'assigned',
      input.source,
      input.actorId,
      input.now,
      completed ? enrollment.completed_at ?? input.now : null,
      input.now,
      input.renewalMonths,
      cycle,
    ),
  ]

  return { id: assignmentId, completed, existing: false, statements }
}
