import {
  certificateEffectiveStatus,
  snapshotCertificateValidity,
  type StoredValidityPolicy,
} from './_certificateValidity'

export interface CertificateIssueInput {
  tenantId: string
  studentId: string
  studentName?: string | null
  courseId?: string | null
  quizId?: string | null
  cycleId?: string | null
}

export async function tryIssueCertificate(db: any, input: CertificateIssueInput) {
  let policy: any = null
  if (input.courseId) {
    policy = await db.prepare('SELECT * FROM academy_course_completion_policy WHERE tenant_id=? AND course_id=? LIMIT 1')
      .bind(input.tenantId, input.courseId).first()
  } else if (input.quizId) {
    policy = await db.prepare('SELECT * FROM academy_course_completion_policy WHERE tenant_id=? AND quiz_id=? LIMIT 1')
      .bind(input.tenantId, input.quizId).first()
  }
  if (!policy) return { issued: false, reason: 'completion_policy_missing' }

  const courseId = String(policy.course_id ?? '')
  const course = courseId
    ? await db.prepare(`SELECT id, title, instructor_label, certificate_type FROM academy_courses WHERE tenant_id=? AND id=? LIMIT 1`)
        .bind(input.tenantId, courseId).first()
    : null
  const courseTitle = String(course?.title ?? policy.course_title ?? '').trim()
  const instructorLabel = String(course?.instructor_label ?? '').trim()
  const certificateType = String(course?.certificate_type ?? 'free_course').trim()
  const studentName = String(input.studentName ?? '').trim()
  if (!courseId || !courseTitle || !studentName || !instructorLabel) {
    return { issued: false, reason: 'certificate_metadata_incomplete' }
  }

  const enrollment = await db.prepare(`
    SELECT e.*, lc.cycle_number, lc.status AS cycle_status, lc.completed_at AS cycle_completed_at
    FROM academy_enrollments e
    LEFT JOIN academy_learning_cycles lc ON lc.tenant_id=e.tenant_id AND lc.id=e.active_cycle_id
    WHERE e.tenant_id=? AND e.student_id=? AND e.course_id=? LIMIT 1
  `).bind(input.tenantId, input.studentId, courseId).first()
  const cycleId = String(input.cycleId ?? enrollment?.active_cycle_id ?? '').trim()
  if (!cycleId) return { issued: false, reason: 'learning_cycle_missing' }

  const cycle = await db.prepare(`
    SELECT * FROM academy_learning_cycles
    WHERE tenant_id=? AND id=? AND student_id=? AND course_id=? LIMIT 1
  `).bind(input.tenantId, cycleId, input.studentId, courseId).first()
  if (!cycle) return { issued: false, reason: 'learning_cycle_missing' }
  if (String(cycle.status) !== 'completed') return { issued: false, reason: 'learning_cycle_not_completed' }

  const existing = await db.prepare(`
    SELECT * FROM academy_certificates
    WHERE tenant_id=? AND student_id=? AND course_id=? AND cycle_id=?
    LIMIT 1
  `).bind(input.tenantId, input.studentId, courseId, cycleId).first()
  if (existing) return { issued: false, idempotent: true, reason: 'already_issued', certificate: existing }

  const progress = await db.prepare(`
    SELECT COUNT(l.id) AS required,
      SUM(CASE WHEN COALESCE(p.progress_percent,0)>=100 THEN 1 ELSE 0 END) AS completed
    FROM academy_course_lessons l
    LEFT JOIN academy_progress p
      ON p.tenant_id=l.tenant_id AND p.course_id=l.course_id AND p.lesson_id=l.id
      AND p.student_id=? AND p.cycle_id=?
    WHERE l.tenant_id=? AND l.course_id=? AND l.required=1
  `).bind(input.studentId, cycleId, input.tenantId, courseId).first()
  const required = Math.max(Number(progress?.required ?? 0), Number(policy.required_lessons_count ?? 0))
  const completed = Number(progress?.completed ?? 0)
  if (required < 1 || completed < required) return { issued: false, reason: 'progress_incomplete', details: { completed, required, cycleId } }

  let finalScore: number | null = null
  if (Number(policy.assessment_required) === 1) {
    const quizId = String(policy.quiz_id ?? '')
    if (!quizId) return { issued: false, reason: 'assessment_policy_incomplete' }
    const attempt = await db.prepare(`
      SELECT * FROM academy_quiz_attempts
      WHERE tenant_id=? AND cycle_id=? AND quiz_id=? AND student_id=? AND status='approved'
      ORDER BY attempt_number DESC LIMIT 1
    `).bind(input.tenantId, cycleId, quizId, input.studentId).first()
    if (!attempt) return { issued: false, reason: 'assessment_not_approved' }
    finalScore = Number(attempt.final_percentage)
    const minimumScore = Number(policy.minimum_score ?? 0)
    if (!Number.isFinite(finalScore) || finalScore < minimumScore) {
      return { issued: false, reason: 'minimum_score_not_reached', details: { finalScore, minimumScore, cycleId } }
    }
  }

  const workload = await db.prepare(`SELECT COALESCE(SUM(duration_minutes),0) AS workload_minutes FROM academy_course_lessons WHERE tenant_id=? AND course_id=?`)
    .bind(input.tenantId, courseId).first()
  const workloadMinutes = Math.max(0, Number(workload?.workload_minutes ?? 0))

  const id = crypto.randomUUID()
  const issuedAt = new Date().toISOString()
  const completionDate = String(cycle.completed_at ?? issuedAt)
  const publicCode = 'IFA-' + issuedAt.slice(0,4) + '-' + crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase()

  const validityPolicy = await db.prepare(`
    SELECT * FROM academy_certificate_validity_policies
    WHERE tenant_id=? AND course_id=? LIMIT 1
  `).bind(input.tenantId, courseId).first()
  const validity = snapshotCertificateValidity(
    completionDate,
    validityPolicy ? validityPolicy as StoredValidityPolicy : null,
  )
  const metadataVersion = 2

  await db.prepare(`
    INSERT INTO academy_certificates (
      id, cycle_id, public_code, student_id, student_name, course_id, course_title,
      final_score, issued_at, status, tenant_id, workload_minutes,
      instructor_label, certificate_type, completion_date, metadata_version,
      validity_mode, validity_policy_version, valid_until, validity_policy_snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'valid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, cycleId, publicCode, input.studentId, studentName, courseId, courseTitle,
    finalScore, issuedAt, input.tenantId, workloadMinutes, instructorLabel,
    certificateType, completionDate, metadataVersion,
    validity.validityMode, validity.validityPolicyVersion, validity.validUntil,
    JSON.stringify(validity.snapshot),
  ).run()

  const effectiveStatus = certificateEffectiveStatus('valid', validity.validUntil, new Date(issuedAt))

  return { issued: true, certificate: {
    id, cycleId, cycleNumber: Number(cycle.cycle_number ?? 1), publicCode,
    tenantId: input.tenantId, studentId: input.studentId, studentName,
    courseId, courseTitle, finalScore, issuedAt, completionDate,
    workloadMinutes, instructorLabel, certificateType, metadataVersion,
    status: 'valid', effectiveStatus,
    validityMode: validity.validityMode,
    validityPolicyVersion: validity.validityPolicyVersion,
    validUntil: validity.validUntil,
    validityPolicyConfigured: validity.validityMode !== 'not_configured',
  } }
}
