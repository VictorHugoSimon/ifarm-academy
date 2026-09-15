import { requireTrustedContext } from './_auth'
import { buildTutorLearningSignals, type LearningAttemptState, type LearningLessonState } from './_tutorLearningSignals'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const url = new URL(request.url)
  const courseId = (url.searchParams.get('courseId') ?? '').trim()
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const enrollment = await db.prepare(`
    SELECT id, status, active_cycle_id
    FROM academy_enrollments
    WHERE tenant_id=? AND student_id=? AND course_id=? AND status IN ('active','completed')
    LIMIT 1
  `).bind(auth.tenantId, auth.userId, courseId).first()
  if (!enrollment?.active_cycle_id) return json({ error: 'Matrícula/ciclo acadêmico não encontrado' }, 403)

  const course = await db.prepare(`
    SELECT c.id, c.title, c.status, p.enabled AS tutor_enabled
    FROM academy_courses c
    LEFT JOIN academy_tutor_course_policies p
      ON p.tenant_id=c.tenant_id AND p.course_id=c.id
    WHERE c.tenant_id=? AND c.id=?
    LIMIT 1
  `).bind(auth.tenantId, courseId).first()
  if (!course || String(course.status) !== 'published') return json({ error: 'Curso não disponível para Learning Signals' }, 404)
  if (Number(course.tutor_enabled ?? 0) !== 1) return json({ error: 'O Tutor IA não está autorizado para este curso' }, 403)

  const cycle = await db.prepare(`
    SELECT id, cycle_number, status, started_at, completed_at
    FROM academy_learning_cycles
    WHERE id=? AND tenant_id=? AND student_id=? AND course_id=?
    LIMIT 1
  `).bind(String(enrollment.active_cycle_id), auth.tenantId, auth.userId, courseId).first()
  if (!cycle) return json({ error: 'Ciclo acadêmico atual não encontrado' }, 409)

  const lessonRows = await db.prepare(`
    SELECT l.id, l.title, l.required, m.position AS module_position, l.position,
           COALESCE(p.progress_percent, 0) AS progress_percent,
           p.completed_at
    FROM academy_course_lessons l
    JOIN academy_course_modules m
      ON m.id=l.module_id AND m.course_id=l.course_id AND m.tenant_id=l.tenant_id
    LEFT JOIN academy_progress p
      ON p.tenant_id=l.tenant_id AND p.course_id=l.course_id
      AND p.lesson_id=l.id AND p.cycle_id=? AND p.student_id=?
    WHERE l.tenant_id=? AND l.course_id=?
    ORDER BY m.position, l.position, l.id
  `).bind(String(cycle.id), auth.userId, auth.tenantId, courseId).all()

  const lessons: LearningLessonState[] = (lessonRows.results as any[]).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    required: Number(row.required) === 1,
    position: Number(row.module_position ?? 0) * 10000 + Number(row.position ?? 0),
    progressPercent: Number(row.progress_percent ?? 0),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  }))

  const policy = await db.prepare(`
    SELECT assessment_required, quiz_id, minimum_score
    FROM academy_course_completion_policy
    WHERE tenant_id=? AND course_id=?
    LIMIT 1
  `).bind(auth.tenantId, courseId).first()

  const assessmentRequired = Number(policy?.assessment_required ?? 0) === 1
  const quizId = policy?.quiz_id ? String(policy.quiz_id) : null
  let attempts: LearningAttemptState[] = []
  if (assessmentRequired && quizId) {
    const rows = await db.prepare(`
      SELECT id, attempt_number, status, final_percentage
      FROM academy_quiz_attempts
      WHERE tenant_id=? AND student_id=? AND cycle_id=? AND quiz_id=?
      ORDER BY attempt_number DESC
    `).bind(auth.tenantId, auth.userId, String(cycle.id), quizId).all()
    attempts = (rows.results as any[]).map((row) => ({
      id: String(row.id),
      attemptNumber: Number(row.attempt_number),
      status: String(row.status) as LearningAttemptState['status'],
      finalPercentage: row.final_percentage == null ? null : Number(row.final_percentage),
    }))
  }

  const computed = buildTutorLearningSignals({
    cycleStatus: String(cycle.status) as 'active' | 'completed' | 'cancelled',
    lessons,
    assessmentRequired,
    minimumScore: policy?.minimum_score == null ? null : Number(policy.minimum_score),
    attempts,
  })

  return json({
    data: {
      courseId,
      courseTitle: String(course.title),
      cycleId: String(cycle.id),
      cycleNumber: Number(cycle.cycle_number),
      cycleStatus: String(cycle.status),
      source: 'academic_state_only',
      generatedAt: new Date().toISOString(),
      metrics: computed.metrics,
      signals: computed.signals,
      privacy: {
        diagnostic: false,
        commercialProfiling: false,
        persistsProfile: false,
        providerAttempted: false,
      },
    },
  })
}
