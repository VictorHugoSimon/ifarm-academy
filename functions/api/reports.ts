import { requireAdminContext } from './_auth'
import { evaluateRenewal } from './_renewal'
import { nullableNumber, numberValue, percent, resolveReportWindow } from './_reporting'
import { dbOr503, json, type Env } from './_shared'

const reportRoles = ['academy_admin', 'ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, reportRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const window = resolveReportWindow(request)
  if (window instanceof Response) return window

  const generatedAt = new Date()
  const nowIso = generatedAt.toISOString()
  const future30Iso = new Date(generatedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const tenantId = auth.tenantId

  const publishedCourses = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_courses
    WHERE tenant_id=? AND status='published'
  `).bind(tenantId).first()

  const learners = await db.prepare(`
    SELECT COUNT(DISTINCT student_id) AS total FROM academy_enrollments
    WHERE tenant_id=? AND status!='cancelled'
  `).bind(tenantId).first()

  const activeCycles = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_learning_cycles
    WHERE tenant_id=? AND status='active'
  `).bind(tenantId).first()

  const periodEnrollments = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_enrollments
    WHERE tenant_id=? AND enrolled_at BETWEEN ? AND ?
  `).bind(tenantId, window.from, window.to).first()

  const completedCycles = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_learning_cycles
    WHERE tenant_id=? AND status='completed' AND completed_at BETWEEN ? AND ?
  `).bind(tenantId, window.from, window.to).first()

  const periodCertificates = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_certificates
    WHERE tenant_id=? AND status='valid' AND issued_at BETWEEN ? AND ?
  `).bind(tenantId, window.from, window.to).first()

  const assessmentSummary = await db.prepare(`
    SELECT
      COUNT(*) AS evaluated,
      SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
      AVG(final_percentage) AS average_score
    FROM academy_quiz_attempts
    WHERE tenant_id=?
      AND status IN ('approved','failed')
      AND submitted_at BETWEEN ? AND ?
  `).bind(tenantId, window.from, window.to).first()

  const coursePerformance = await db.prepare(`
    SELECT
      c.id,
      c.title,
      c.status,
      c.certificate_type,
      (SELECT COUNT(*) FROM academy_learning_cycles lc
        WHERE lc.tenant_id=c.tenant_id AND lc.course_id=c.id) AS cycles,
      (SELECT COUNT(*) FROM academy_learning_cycles lc
        WHERE lc.tenant_id=c.tenant_id AND lc.course_id=c.id AND lc.status='completed') AS completed_cycles,
      (SELECT COUNT(*) FROM academy_certificates cert
        WHERE cert.tenant_id=c.tenant_id AND cert.course_id=c.id AND cert.status='valid') AS certificates,
      (SELECT AVG(a.final_percentage)
        FROM academy_quiz_attempts a
        JOIN academy_course_completion_policy cp
          ON cp.tenant_id=a.tenant_id AND cp.quiz_id=a.quiz_id
        WHERE a.tenant_id=c.tenant_id AND cp.course_id=c.id
          AND a.status IN ('approved','failed')
          AND a.submitted_at BETWEEN ? AND ?) AS average_score
    FROM academy_courses c
    WHERE c.tenant_id=? AND c.status!='draft'
    ORDER BY cycles DESC, c.title
    LIMIT 25
  `).bind(window.from, window.to, tenantId).all()

  const activeCompanies = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_companies
    WHERE tenant_id=? AND status='active'
  `).bind(tenantId).first()

  const activeMembers = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_company_members
    WHERE tenant_id=? AND status='active'
  `).bind(tenantId).first()

  const openAssignments = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_course_assignments
    WHERE tenant_id=? AND status IN ('assigned','in_progress')
  `).bind(tenantId).first()

  const overdueAssignments = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_course_assignments
    WHERE tenant_id=? AND status IN ('assigned','in_progress')
      AND due_at IS NOT NULL AND due_at < ?
  `).bind(tenantId, nowIso).first()

  const completedAssignments = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_course_assignments
    WHERE tenant_id=? AND status='completed' AND completed_at BETWEEN ? AND ?
  `).bind(tenantId, window.from, window.to).first()

  const allEnterpriseAssignments = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed
    FROM academy_course_assignments
    WHERE tenant_id=? AND status!='cancelled'
  `).bind(tenantId).first()

  const renewalRows = await db.prepare(`
    SELECT id, completed_at, renewal_months
    FROM academy_course_assignments
    WHERE tenant_id=? AND status='completed'
      AND completed_at IS NOT NULL AND renewal_months IS NOT NULL
  `).bind(tenantId).all()

  const renewalStates = (renewalRows.results as any[]).map((row) =>
    evaluateRenewal(String(row.completed_at), Number(row.renewal_months), generatedAt),
  )

  const companyPerformance = await db.prepare(`
    SELECT
      c.id,
      c.name,
      c.status,
      (SELECT COUNT(*) FROM academy_company_members m
        WHERE m.tenant_id=c.tenant_id AND m.company_id=c.id AND m.status='active') AS active_members,
      (SELECT COUNT(*) FROM academy_course_assignments a
        WHERE a.tenant_id=c.tenant_id AND a.company_id=c.id AND a.status!='cancelled') AS assignments,
      (SELECT COUNT(*) FROM academy_course_assignments a
        WHERE a.tenant_id=c.tenant_id AND a.company_id=c.id AND a.status='completed') AS completed_assignments,
      (SELECT COUNT(*) FROM academy_course_assignments a
        WHERE a.tenant_id=c.tenant_id AND a.company_id=c.id
          AND a.status IN ('assigned','in_progress') AND a.due_at IS NOT NULL AND a.due_at < ?) AS overdue_assignments,
      (SELECT COUNT(*) FROM academy_company_path_assignments pa
        WHERE pa.tenant_id=c.tenant_id AND pa.company_id=c.id AND pa.status!='cancelled') AS path_assignments
    FROM academy_companies c
    WHERE c.tenant_id=?
    ORDER BY assignments DESC, c.name
    LIMIT 25
  `).bind(nowIso, tenantId).all()

  const upcomingEvents = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_events
    WHERE tenant_id=? AND status='published' AND ends_at>=?
  `).bind(tenantId, nowIso).first()

  const smartFarmUpcoming = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_events
    WHERE tenant_id=? AND status='published' AND smart_farm_experience=1 AND ends_at>=?
  `).bind(tenantId, nowIso).first()

  const eventRegistrationsPeriod = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_event_registrations
    WHERE tenant_id=? AND registered_at BETWEEN ? AND ?
  `).bind(tenantId, window.from, window.to).first()

  const currentWaitlist = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_event_registrations
    WHERE tenant_id=? AND status='waitlisted'
  `).bind(tenantId).first()

  const attendanceSummary = await db.prepare(`
    SELECT
      SUM(CASE WHEN r.status='attended' THEN 1 ELSE 0 END) AS attended,
      SUM(CASE WHEN r.status='no_show' THEN 1 ELSE 0 END) AS no_show
    FROM academy_events e
    JOIN academy_event_registrations r
      ON r.tenant_id=e.tenant_id AND r.event_id=e.id
    WHERE e.tenant_id=? AND e.ends_at BETWEEN ? AND ?
  `).bind(tenantId, window.from, window.to).first()

  const eventPerformance = await db.prepare(`
    SELECT
      e.id,
      e.title,
      e.event_type,
      e.modality,
      e.access_model,
      e.starts_at,
      e.ends_at,
      e.capacity,
      e.smart_farm_experience,
      SUM(CASE WHEN r.status IN ('registered','attended') THEN 1 ELSE 0 END) AS occupied,
      SUM(CASE WHEN r.status='waitlisted' THEN 1 ELSE 0 END) AS waitlisted,
      SUM(CASE WHEN r.status='attended' THEN 1 ELSE 0 END) AS attended,
      SUM(CASE WHEN r.status='no_show' THEN 1 ELSE 0 END) AS no_show
    FROM academy_events e
    LEFT JOIN academy_event_registrations r
      ON r.tenant_id=e.tenant_id AND r.event_id=e.id
    WHERE e.tenant_id=? AND e.status!='cancelled'
    GROUP BY e.id
    ORDER BY e.starts_at DESC
    LIMIT 25
  `).bind(tenantId).all()

  const regulatoryCourses = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_courses
    WHERE tenant_id=? AND certificate_type='regulatory_training'
  `).bind(tenantId).first()

  const verifiedQualifications = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_instructor_qualifications
    WHERE tenant_id=? AND verification_status='verified'
      AND (expires_at IS NULL OR expires_at>?)
  `).bind(tenantId, nowIso).first()

  const expiringQualifications = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_instructor_qualifications
    WHERE tenant_id=? AND verification_status='verified'
      AND expires_at>? AND expires_at<=?
  `).bind(tenantId, nowIso, future30Iso).first()

  const expiredQualifications = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_instructor_qualifications
    WHERE tenant_id=? AND (
      verification_status='expired'
      OR (verification_status='verified' AND expires_at IS NOT NULL AND expires_at<=?)
    )
  `).bind(tenantId, nowIso).first()

  const activeTechnicalResponsibility = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM academy_course_instructor_roles r
    JOIN academy_instructor_qualifications q
      ON q.tenant_id=r.tenant_id AND q.id=r.qualification_id AND q.instructor_id=r.instructor_id
    WHERE r.tenant_id=? AND r.role='technical_responsible' AND r.status='active'
      AND r.suitability_confirmed=1
      AND q.verification_status='verified'
      AND (q.expires_at IS NULL OR q.expires_at>?)
  `).bind(tenantId, nowIso).first()

  const regulatoryCertificatesPeriod = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_certificates
    WHERE tenant_id=? AND certificate_type='regulatory_training'
      AND status='valid' AND issued_at BETWEEN ? AND ?
  `).bind(tenantId, window.from, window.to).first()

  const regulatoryCourseGovernance = await db.prepare(`
    SELECT
      c.id,
      c.title,
      c.status,
      (SELECT COUNT(*) FROM academy_course_instructor_roles r
        WHERE r.tenant_id=c.tenant_id AND r.course_id=c.id
          AND r.role='technical_responsible' AND r.status='active') AS technical_responsibles,
      (SELECT COUNT(*)
        FROM academy_course_instructor_roles r
        JOIN academy_instructor_qualifications q
          ON q.tenant_id=r.tenant_id AND q.id=r.qualification_id AND q.instructor_id=r.instructor_id
        WHERE r.tenant_id=c.tenant_id AND r.course_id=c.id
          AND r.role='technical_responsible' AND r.status='active'
          AND r.suitability_confirmed=1
          AND q.verification_status='verified'
          AND (q.expires_at IS NULL OR q.expires_at>?)) AS current_verified_responsibles
    FROM academy_courses c
    WHERE c.tenant_id=? AND c.certificate_type='regulatory_training'
    ORDER BY c.status='published' DESC, c.title
  `).bind(nowIso, tenantId).all()

  const evaluated = numberValue(assessmentSummary?.evaluated)
  const approved = numberValue(assessmentSummary?.approved)
  const enterpriseTotal = numberValue(allEnterpriseAssignments?.total)
  const enterpriseCompleted = numberValue(allEnterpriseAssignments?.completed)
  const attended = numberValue(attendanceSummary?.attended)
  const noShow = numberValue(attendanceSummary?.no_show)

  const regulatoryRows = (regulatoryCourseGovernance.results as any[]).map((row) => ({
    courseId: row.id,
    courseTitle: row.title,
    status: row.status,
    technicalResponsibles: numberValue(row.technical_responsibles),
    currentVerifiedResponsibles: numberValue(row.current_verified_responsibles),
    technicalGovernanceCovered: numberValue(row.current_verified_responsibles) > 0,
  }))

  return json({
    generatedAt: generatedAt.toISOString(),
    window,
    academic: {
      kpis: {
        publishedCourses: numberValue(publishedCourses?.total),
        learners: numberValue(learners?.total),
        activeCycles: numberValue(activeCycles?.total),
        enrollmentsInPeriod: numberValue(periodEnrollments?.total),
        completedCyclesInPeriod: numberValue(completedCycles?.total),
        certificatesInPeriod: numberValue(periodCertificates?.total),
        assessmentApprovalRate: percent(approved, evaluated),
        averageAssessmentScore: nullableNumber(assessmentSummary?.average_score),
      },
      courses: (coursePerformance.results as any[]).map((row) => ({
        courseId: row.id,
        courseTitle: row.title,
        status: row.status,
        certificateType: row.certificate_type,
        cycles: numberValue(row.cycles),
        completedCycles: numberValue(row.completed_cycles),
        completionRate: percent(numberValue(row.completed_cycles), numberValue(row.cycles)),
        certificates: numberValue(row.certificates),
        averageScore: nullableNumber(row.average_score),
      })),
    },
    enterprise: {
      kpis: {
        activeCompanies: numberValue(activeCompanies?.total),
        activeMembers: numberValue(activeMembers?.total),
        openAssignments: numberValue(openAssignments?.total),
        overdueAssignments: numberValue(overdueAssignments?.total),
        completedAssignmentsInPeriod: numberValue(completedAssignments?.total),
        completionRate: percent(enterpriseCompleted, enterpriseTotal),
        renewalsDue: renewalStates.filter((item) => item.state === 'due').length,
        renewalsUpcoming: renewalStates.filter((item) => item.state === 'upcoming').length,
      },
      companies: (companyPerformance.results as any[]).map((row) => ({
        companyId: row.id,
        companyName: row.name,
        status: row.status,
        activeMembers: numberValue(row.active_members),
        assignments: numberValue(row.assignments),
        completedAssignments: numberValue(row.completed_assignments),
        completionRate: percent(numberValue(row.completed_assignments), numberValue(row.assignments)),
        overdueAssignments: numberValue(row.overdue_assignments),
        pathAssignments: numberValue(row.path_assignments),
      })),
    },
    events: {
      kpis: {
        upcomingEvents: numberValue(upcomingEvents?.total),
        smartFarmUpcoming: numberValue(smartFarmUpcoming?.total),
        registrationsInPeriod: numberValue(eventRegistrationsPeriod?.total),
        currentWaitlist: numberValue(currentWaitlist?.total),
        attendanceRate: percent(attended, attended + noShow),
        attendedInCompletedEvents: attended,
        noShowInCompletedEvents: noShow,
      },
      events: (eventPerformance.results as any[]).map((row) => ({
        eventId: row.id,
        title: row.title,
        eventType: row.event_type,
        modality: row.modality,
        accessModel: row.access_model,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        capacity: row.capacity == null ? null : numberValue(row.capacity),
        occupied: numberValue(row.occupied),
        occupancyRate: row.capacity == null ? null : percent(numberValue(row.occupied), numberValue(row.capacity)),
        waitlisted: numberValue(row.waitlisted),
        attended: numberValue(row.attended),
        noShow: numberValue(row.no_show),
        smartFarmExperience: numberValue(row.smart_farm_experience) === 1,
      })),
    },
    technicalGovernance: {
      kpis: {
        regulatoryCourses: numberValue(regulatoryCourses?.total),
        regulatoryCoursesMissingCurrentResponsible: regulatoryRows.filter((row) => row.status === 'published' && !row.technicalGovernanceCovered).length,
        verifiedCurrentQualifications: numberValue(verifiedQualifications?.total),
        qualificationsExpiringIn30Days: numberValue(expiringQualifications?.total),
        expiredQualifications: numberValue(expiredQualifications?.total),
        activeVerifiedTechnicalResponsibilities: numberValue(activeTechnicalResponsibility?.total),
        regulatoryCertificatesInPeriod: numberValue(regulatoryCertificatesPeriod?.total),
      },
      courses: regulatoryRows,
      disclaimer: 'Cobertura de governança técnica não constitui declaração automática de conformidade legal ou habilitação profissional. A norma aplicável e a adequação do responsável exigem validação humana.',
    },
  })
}
