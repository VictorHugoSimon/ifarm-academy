export interface LearningCycleRow {
  id: string
  tenant_id: string
  enrollment_id: string
  student_id: string
  course_id: string
  cycle_number: number
  status: 'active' | 'completed' | 'cancelled'
  source: string
  company_id?: string | null
  member_id?: string | null
  renewal_of_cycle_id?: string | null
  due_at?: string | null
  started_at: string
  completed_at?: string | null
}

export async function getEnrollmentWithCycle(db: any, tenantId: string, studentId: string, courseId: string) {
  return db.prepare(`
    SELECT e.*, lc.status AS cycle_status, lc.cycle_number, lc.source AS cycle_source,
      lc.started_at AS cycle_started_at, lc.completed_at AS cycle_completed_at,
      lc.due_at AS cycle_due_at, lc.renewal_of_cycle_id
    FROM academy_enrollments e
    LEFT JOIN academy_learning_cycles lc
      ON lc.id=e.active_cycle_id AND lc.tenant_id=e.tenant_id
    WHERE e.tenant_id=? AND e.student_id=? AND e.course_id=?
    LIMIT 1
  `).bind(tenantId, studentId, courseId).first()
}

export async function getActiveCycle(db: any, tenantId: string, studentId: string, courseId: string): Promise<LearningCycleRow | null> {
  const enrollment = await getEnrollmentWithCycle(db, tenantId, studentId, courseId)
  if (!enrollment?.active_cycle_id) return null
  const cycle = await db.prepare(`
    SELECT * FROM academy_learning_cycles
    WHERE tenant_id=? AND id=? AND student_id=? AND course_id=?
    LIMIT 1
  `).bind(tenantId, enrollment.active_cycle_id, studentId, courseId).first()
  return cycle ? cycle as LearningCycleRow : null
}

export async function nextCycleNumber(db: any, tenantId: string, studentId: string, courseId: string): Promise<number> {
  const row = await db.prepare(`
    SELECT MAX(cycle_number) AS cycle_number
    FROM academy_learning_cycles
    WHERE tenant_id=? AND student_id=? AND course_id=?
  `).bind(tenantId, studentId, courseId).first()
  return Math.max(1, Number(row?.cycle_number ?? 0) + 1)
}

export function learningCycleInsertStatement(db: any, input: {
  id: string
  tenantId: string
  enrollmentId: string
  studentId: string
  courseId: string
  cycleNumber: number
  source: string
  companyId?: string | null
  memberId?: string | null
  renewalOfCycleId?: string | null
  dueAt?: string | null
  startedAt: string
}) {
  return db.prepare(`
    INSERT INTO academy_learning_cycles (
      id, tenant_id, enrollment_id, student_id, course_id, cycle_number,
      status, source, company_id, member_id, renewal_of_cycle_id, due_at,
      started_at, completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).bind(
    input.id, input.tenantId, input.enrollmentId, input.studentId, input.courseId,
    input.cycleNumber, input.source, input.companyId ?? null, input.memberId ?? null,
    input.renewalOfCycleId ?? null, input.dueAt ?? null, input.startedAt,
    input.startedAt, input.startedAt,
  )
}
