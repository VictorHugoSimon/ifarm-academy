import { tryIssueCertificate } from './_certificate'

export interface CompletionInput {
  tenantId: string
  studentId: string
  courseId: string
  studentName?: string | null
}

export async function tryCompleteEnrollment(db: any, input: CompletionInput) {
  const enrollment = await db.prepare(`
    SELECT * FROM academy_enrollments
    WHERE tenant_id=? AND course_id=? AND student_id=?
    LIMIT 1
  `).bind(input.tenantId, input.courseId, input.studentId).first()

  if (!enrollment) return { completed: false, newlyCompleted: false, reason: 'enrollment_missing' }
  if (String(enrollment.status) === 'cancelled') return { completed: false, newlyCompleted: false, reason: 'enrollment_cancelled' }

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
    WHERE l.tenant_id=? AND l.course_id=? AND l.required=1
  `).bind(input.studentId, input.tenantId, input.courseId).first()

  const requiredByStructure = Number(progress?.required ?? 0)
  const requiredByPolicy = Number(policy.required_lessons_count ?? 0)
  const requiredLessons = Math.max(requiredByStructure, requiredByPolicy)
  const completedLessons = Number(progress?.completed ?? 0)
  if (requiredLessons < 1 || completedLessons < requiredLessons) {
    return {
      completed: false,
      newlyCompleted: false,
      reason: 'required_lessons_incomplete',
      details: { completedLessons, requiredLessons },
    }
  }

  let finalScore: number | null = null
  if (Number(policy.assessment_required) === 1) {
    const quizId = String(policy.quiz_id ?? '')
    if (!quizId) return { completed: false, newlyCompleted: false, reason: 'assessment_policy_incomplete' }

    const attempt = await db.prepare(`
      SELECT * FROM academy_quiz_attempts
      WHERE tenant_id=? AND quiz_id=? AND student_id=? AND status='approved'
      ORDER BY attempt_number DESC
      LIMIT 1
    `).bind(input.tenantId, quizId, input.studentId).first()

    if (!attempt) return { completed: false, newlyCompleted: false, reason: 'assessment_not_approved' }
    finalScore = Number(attempt.final_percentage)
    const minimumScore = Number(policy.minimum_score ?? 0)
    if (!Number.isFinite(finalScore) || finalScore < minimumScore) {
      return { completed: false, newlyCompleted: false, reason: 'minimum_score_not_reached', details: { finalScore, minimumScore } }
    }
  }

  const newlyCompleted = String(enrollment.status) !== 'completed'
  const completedAt = enrollment.completed_at ? String(enrollment.completed_at) : new Date().toISOString()
  if (newlyCompleted) {
    await db.prepare(`
      UPDATE academy_enrollments
      SET status='completed', completed_at=?, updated_at=?
      WHERE tenant_id=? AND course_id=? AND student_id=? AND status='active'
    `).bind(completedAt, completedAt, input.tenantId, input.courseId, input.studentId).run()
  }

  const certificate = await tryIssueCertificate(db, {
    tenantId: input.tenantId,
    studentId: input.studentId,
    studentName: input.studentName ?? enrollment.student_name_snapshot ?? null,
    courseId: input.courseId,
  })

  return {
    completed: true,
    newlyCompleted,
    completedAt,
    finalScore,
    certificate,
    details: { completedLessons, requiredLessons },
  }
}
