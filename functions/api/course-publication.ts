import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import {
  evaluateCourseReadiness,
  resolveCourseTransition,
  type CoursePublicationAction,
  type CourseStatus,
} from './_coursePublication'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const editorRoles = ['academy_admin', 'academy_instructor', 'instructor', 'ifarm_admin']
const publisherRoles = new Set(['academy_admin', 'ifarm_admin'])
const publicationActions = new Set<CoursePublicationAction>(['submit_review', 'publish', 'return_draft', 'archive'])

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, editorRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const courseId = new URL(request.url).searchParams.get('courseId')?.trim() ?? ''
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const readiness = await evaluateCourseReadiness(db, auth.tenantId, courseId)
  if (!readiness.exists) return json({ error: 'Curso não encontrado neste tenant' }, 404)

  return json({ data: {
    courseId,
    status: readiness.course?.status,
    ready: readiness.ready,
    issues: readiness.issues,
    moduleCount: readiness.moduleCount,
    lessonCount: readiness.lessonCount,
    requiredLessonCount: readiness.requiredLessonCount,
    quizId: readiness.quizId ?? null,
  }})
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, editorRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const courseId = String(body.courseId ?? '').trim()
  const rawAction = String(body.action ?? '').trim()
  if (!courseId || !rawAction) return json({ error: 'courseId e action são obrigatórios' }, 400)
  if (!publicationActions.has(rawAction as CoursePublicationAction)) return json({ error: 'Ação de publicação inválida' }, 400)
  const action = rawAction as CoursePublicationAction

  const readiness = await evaluateCourseReadiness(db, auth.tenantId, courseId)
  if (!readiness.exists || !readiness.course) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  const currentStatus = String(readiness.course.status ?? 'draft') as CourseStatus

  const transition = resolveCourseTransition(currentStatus, action)
  if (!transition.ok || !transition.nextStatus) return json({ error: transition.error ?? 'Transição inválida' }, 409)

  if (transition.publisherRequired && !auth.roles.some((role) => publisherRoles.has(role))) {
    return json({ error: 'Somente administrador pode executar esta transição' }, 403)
  }

  if (transition.readinessRequired && !readiness.ready) {
    return json({ error: 'Curso ainda não está pronto para publicação', issues: readiness.issues }, 409)
  }

  const nextStatus = transition.nextStatus
  const now = new Date().toISOString()
  const statements: any[] = [
    db.prepare(`
      UPDATE academy_courses
      SET status=?, updated_by=?, updated_at=?
      WHERE tenant_id=? AND id=? AND status=?
    `).bind(nextStatus, auth.userId, now, auth.tenantId, courseId, currentStatus),
  ]

  if (action === 'publish') {
    const existingCompletion = await db.prepare(`
      SELECT * FROM academy_course_completion_policy
      WHERE tenant_id=? AND course_id=?
      LIMIT 1
    `).bind(auth.tenantId, courseId).first()

    if (existingCompletion) {
      statements.push(db.prepare(`
        UPDATE academy_course_completion_policy
        SET required_lessons_count=?, course_title=?, updated_at=?
        WHERE tenant_id=? AND course_id=?
      `).bind(
        readiness.requiredLessonCount,
        String(readiness.course.title ?? ''),
        now,
        auth.tenantId,
        courseId,
      ))
    } else {
      statements.push(db.prepare(`
        INSERT INTO academy_course_completion_policy (
          course_id, required_lessons_count, assessment_required, quiz_id,
          minimum_score, updated_at, tenant_id, course_title
        ) VALUES (?, ?, 0, NULL, NULL, ?, ?, ?)
      `).bind(
        courseId,
        readiness.requiredLessonCount,
        now,
        auth.tenantId,
        String(readiness.course.title ?? ''),
      ))
    }
  }

  statements.push(auditStatement(db, auth, {
    action: `course.${action}`,
    resourceType: 'course',
    resourceId: courseId,
    metadata: { from: currentStatus, to: nextStatus, readinessIssues: readiness.issues },
  }))

  await db.batch(statements)

  return json({ data: {
    courseId,
    previousStatus: currentStatus,
    status: nextStatus,
    ready: readiness.ready,
    changedAt: now,
    changedBy: auth.userId,
  }})
}
