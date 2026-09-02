import { tryIssueCertificate } from './_certificate'

export interface CompletionInput {
  tenantId: string
  studentId: string
  courseId: string
  studentName?: string | null
  cycleId?: string | null
}

export async function tryCompleteEnrollment(db: any, input: CompletionInput) {
  const enrollment = await db.prepare(`
    SELECT e.*, lc.status AS cycle_status, lc.cycle_number, lc.completed_at AS cycle_completed_at
    FROM academy_enrollments e
    LEFT JOIN academy_learning_cycles lc
      ON lc.tenant_id=e.tenant_id AND lc.id=e.active_cycle_id
    WHERE e.tenant_id=? AND e.course_id=? AND e.student_id=?
    LIMIT 1
  `).bind(input.tenantId, input.courseId, input.studentId).first()

  if (!enrollment) return { completed: false, newlyCompleted: false, reason: 'enrollment_missing' }
  if (String(enrollment.status) === 'cancelled') return { completed: false, newlyCompleted: false, reason: 'enrollment_cancelled' }

  const cycleId = String(input.cycleId ?? enrollment.active_cycle_id ?? '').trim()
  if (!cycleId) return { completed: false, newlyCompleted: false, reason: 'learning_cycle_missing' }
  if (String(enrollment.active_cycle_id ?? '') !== cycleId) {
    return { completed: false, newlyCompleted: false, reason: 'learning_cycle_not_current' }
  }

  const cycle = await db.prepare(`
    SELECT * FROM academy_learning_cycles
    WHERE tenant_id=? AND id=? AND student_id=? AND course_id=?
    LIMIT 1
  `).bind(input.tenantId, cycleId, input.studentId, input.courseId).first()
  if (!cycle) return { completed: false, newlyCompleted: false, reason: 'learning_cycle_missing' }
  if (String(cycle.status) === 'cancelled') return { completed: false, newlyCompleted: false, reason: 'learning_cycle_cancelled' }

  const policy = await db.prepare(`
    SELECT * FROM academy_course_completion_policy
    WHERE tenant_id=? AND course_id=?
    LIMIT 1
  `).bind(input.tenantId, input.courseId).first()
  if (!policy) return { completed: false, newlyCompleted: false, reason: 'completion_policy_missing' }

  const progress = await db.prepare(`
    SELECT
      COUNT(l.id) AS required,
      SUM(CASE WHEN COALESCE(p.progress_percent, 0) >= 100 THEN 1 ELSE 0 END) AS completed
    FROM academy_course_lessons l
    LEFT JOIN academy_progress p
      ON p.tenant_id=l.tenant_id
      AND p.course_id=l.course_id
      AND p.lesson_id=l.id
      AND p.student_id=?
      AND p.cycle_id=?
    WHERE l.tenant_id=? AND l.course_id=? AND l.required=1
  `).bind(input.studentId, cycleId, input.tenantId, input.courseId).first()

  const requiredByStructure = Number(progress?.required ?? 0)
  const requiredByPolicy = Number(policy.required_lessons_count ?? 0)
  const requiredLessons = Math.max(requiredByStructure, requiredByPolicy)
  const completedLessons = Number(progress?.completed ?? 0)
  if (requiredLessons < 1 || completedLessons < requiredLessons) {
    return { completed: false, newlyCompleted: false, reason: 'required_lessons_incomplete', details: { completedLessons, requiredLessons, cycleId } }
  }

  let finalScore: number | null = null
  if (Number(policy.assessment_required) === 1) {
    const quizId = String(policy.quiz_id ?? '')
    if (!quizId) return { completed: false, newlyCompleted: false, reason: 'assessment_policy_incomplete' }
    const attempt = await db.prepare(`
      SELECT * FROM academy_quiz_attempts
      WHERE tenant_id=? AND cycle_id=? AND quiz_id=? AND student_id=? AND status='approved'
      ORDER BY attempt_number DESC LIMIT 1
    `).bind(input.tenantId, cycleId, quizId, input.studentId).first()
    if (!attempt) return { completed: false, newlyCompleted: false, reason: 'assessment_not_approved' }
    finalScore = Number(attempt.final_percentage)
    const minimumScore = Number(policy.minimum_score ?? 0)
    if (!Number.isFinite(finalScore) || finalScore < minimumScore) {
      return { completed: false, newlyCompleted: false, reason: 'minimum_score_not_reached', details: { finalScore, minimumScore, cycleId } }
    }
  }

  const newlyCompleted = String(cycle.status) !== 'completed'
  const completedAt = cycle.completed_at ? String(cycle.completed_at) : new Date().toISOString()
  if (newlyCompleted) {
    await db.batch([
      db.prepare(`
        UPDATE academy_learning_cycles
        SET status='completed', completed_at=?, updated_at=?
        WHERE tenant_id=? AND id=? AND status='active'
      `).bind(completedAt, completedAt, input.tenantId, cycleId),
      db.prepare(`
        UPDATE academy_enrollments
        SET status='completed', completed_at=?, updated_at=?
        WHERE tenant_id=? AND course_id=? AND student_id=? AND active_cycle_id=?
      `).bind(completedAt, completedAt, input.tenantId, input.courseId, input.studentId, cycleId),
    ])
  }

  const certificate = await tryIssueCertificate(db, {
    tenantId: input.tenantId,
    studentId: input.studentId,
    studentName: input.studentName ?? enrollment.student_name_snapshot ?? null,
    courseId: input.courseId,
    cycleId,
  })

  return {
    completed: true,
    newlyCompleted,
    cycleId,
    cycleNumber: Number(cycle.cycle_number ?? 1),
    completedAt,
    finalScore,
    certificate,
    details: { completedLessons, requiredLessons },
  }
}
