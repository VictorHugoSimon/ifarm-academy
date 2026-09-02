import { learningCycleInsertStatement, nextCycleNumber } from './_cycle'

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
    SELECT e.*, lc.status AS cycle_status, lc.cycle_number
    FROM academy_enrollments e
    LEFT JOIN academy_learning_cycles lc ON lc.tenant_id=e.tenant_id AND lc.id=e.active_cycle_id
    WHERE e.tenant_id=? AND e.course_id=? AND e.student_id=? LIMIT 1
  `).bind(input.tenantId, input.courseId, input.member.user_id).first()
  const completed = String(enrollment?.status ?? '') === 'completed'
  const currentCycleId = enrollment?.active_cycle_id == null ? null : String(enrollment.active_cycle_id)

  if (existing) {
    const statements: any[] = []
    const learningCycleId = existing.learning_cycle_id ?? currentCycleId
    if (['assigned', 'in_progress'].includes(String(existing.status))) {
      const stricterDueAt = earlierDate(existing.due_at, input.dueAt)
      const nextRequired = Number(existing.required) === 1 || input.required ? 1 : 0
      const nextRenewal = existing.renewal_months ?? input.renewalMonths
      if (
        stricterDueAt !== (existing.due_at ?? null) ||
        nextRequired !== Number(existing.required) ||
        nextRenewal !== existing.renewal_months ||
        (!existing.learning_cycle_id && learningCycleId)
      ) {
        statements.push(db.prepare(`
          UPDATE academy_course_assignments
          SET due_at=?, required=?, renewal_months=?, learning_cycle_id=?, updated_at=?
          WHERE tenant_id=? AND id=?
        `).bind(stricterDueAt, nextRequired, nextRenewal, learningCycleId, input.now, input.tenantId, existing.id))
      }
    } else if (String(existing.status) === 'completed') {
      const nextRenewal = existing.renewal_months ?? input.renewalMonths
      if (nextRenewal !== existing.renewal_months || (!existing.learning_cycle_id && learningCycleId)) {
        statements.push(db.prepare(`
          UPDATE academy_course_assignments
          SET renewal_months=?, learning_cycle_id=?, updated_at=?
          WHERE tenant_id=? AND id=? AND status='completed'
        `).bind(nextRenewal, learningCycleId, input.now, input.tenantId, existing.id))
      }
    }
    return { id: String(existing.id), completed, existing: true, learningCycleId, statements }
  }

  const assignmentId = crypto.randomUUID()
  const enrollmentId = enrollment ? String(enrollment.id) : crypto.randomUUID()
  const previousAssignmentCycle = await db.prepare(`
    SELECT MAX(renewal_cycle) AS cycle FROM academy_course_assignments
    WHERE tenant_id=? AND company_id=? AND member_id=? AND course_id=?
  `).bind(input.tenantId, input.companyId, input.member.id, input.courseId).first()
  const assignmentCycle = Math.max(1, Number(previousAssignmentCycle?.cycle ?? 0) + 1)
  const statements: any[] = []

  let learningCycleId = currentCycleId
  let learningCycleNumber = enrollment?.cycle_number == null ? null : Number(enrollment.cycle_number)
  const needsFreshCycle = !enrollment || String(enrollment.status) === 'cancelled' || !currentCycleId
  if (needsFreshCycle) {
    learningCycleId = crypto.randomUUID()
    learningCycleNumber = await nextCycleNumber(db, input.tenantId, input.member.user_id, input.courseId)
    statements.push(db.prepare(`
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
      enrollmentId, input.tenantId, input.courseId, input.member.user_id,
      input.member.display_name_snapshot, input.source, input.now, input.now, learningCycleId,
    ))
    statements.push(learningCycleInsertStatement(db, {
      id: learningCycleId,
      tenantId: input.tenantId,
      enrollmentId,
      studentId: input.member.user_id,
      courseId: input.courseId,
      cycleNumber: learningCycleNumber,
      source: input.source,
      companyId: input.companyId,
      memberId: input.member.id,
      dueAt: input.dueAt,
      startedAt: input.now,
    }))
  } else {
    statements.push(db.prepare(`
      UPDATE academy_enrollments
      SET student_name_snapshot=?, updated_at=?
      WHERE tenant_id=? AND id=?
    `).bind(input.member.display_name_snapshot, input.now, input.tenantId, enrollmentId))
  }

  statements.push(db.prepare(`
    INSERT INTO academy_course_assignments (
      id, tenant_id, company_id, member_id, course_id, required, due_at,
      status, source, assigned_by, assigned_at, completed_at, updated_at,
      renewal_months, renewal_cycle, learning_cycle_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    assignmentCycle,
    learningCycleId,
  ))

  return { id: assignmentId, completed, existing: false, learningCycleId, learningCycleNumber, statements }
}
