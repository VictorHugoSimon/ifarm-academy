import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const courseId = new URL(request.url).searchParams.get('courseId')
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const policy = await db.prepare(`
    SELECT * FROM academy_course_completion_policy
    WHERE tenant_id=? AND course_id=?
    LIMIT 1
  `).bind(auth.tenantId, courseId).first()

  return json({ data: policy ?? null })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const courseId = String(body.courseId ?? '').trim()
  const courseTitle = String(body.courseTitle ?? '').trim()
  const requiredLessonsCount = Number(body.requiredLessonsCount ?? 0)
  const assessmentRequired = body.assessmentRequired === true ? 1 : 0
  const quizId = body.quizId == null ? null : String(body.quizId).trim() || null
  const minimumScore = body.minimumScore == null ? null : Number(body.minimumScore)

  if (!courseId || !courseTitle) return json({ error: 'courseId e courseTitle são obrigatórios' }, 400)
  if (!Number.isInteger(requiredLessonsCount) || requiredLessonsCount < 0) {
    return json({ error: 'requiredLessonsCount deve ser inteiro não negativo' }, 400)
  }
  if (assessmentRequired === 1 && !quizId) return json({ error: 'quizId é obrigatório quando há avaliação' }, 400)
  if (minimumScore != null && (!Number.isFinite(minimumScore) || minimumScore < 0 || minimumScore > 100)) {
    return json({ error: 'minimumScore deve estar entre 0 e 100' }, 400)
  }

  const now = new Date().toISOString()
  const statements = [
    db.prepare(`
      INSERT INTO academy_course_completion_policy (
        course_id, required_lessons_count, assessment_required, quiz_id,
        minimum_score, updated_at, tenant_id, course_title
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(course_id) DO UPDATE SET
        required_lessons_count=excluded.required_lessons_count,
        assessment_required=excluded.assessment_required,
        quiz_id=excluded.quiz_id,
        minimum_score=excluded.minimum_score,
        updated_at=excluded.updated_at,
        tenant_id=excluded.tenant_id,
        course_title=excluded.course_title
    `).bind(
      courseId,
      requiredLessonsCount,
      assessmentRequired,
      quizId,
      minimumScore,
      now,
      auth.tenantId,
      courseTitle,
    ),
    auditStatement(db, auth, {
      action: 'completion_policy.updated',
      resourceType: 'course',
      resourceId: courseId,
      metadata: { requiredLessonsCount, assessmentRequired: assessmentRequired === 1, quizId, minimumScore },
    }),
  ]

  await db.batch(statements)

  return json({ data: {
    tenantId: auth.tenantId,
    courseId,
    courseTitle,
    requiredLessonsCount,
    assessmentRequired: assessmentRequired === 1,
    quizId,
    minimumScore,
    updatedAt: now,
  }}, 201)
}
