import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { evaluateCourseReadiness } from './_coursePublication'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const editorRoles = ['academy_admin', 'academy_instructor', 'instructor', 'ifarm_admin']
const publisherRoles = new Set(['academy_admin', 'ifarm_admin'])

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
  const action = String(body.action ?? '').trim()
  if (!courseId || !action) return json({ error: 'courseId e action são obrigatórios' }, 400)

  const readiness = await evaluateCourseReadiness(db, auth.tenantId, courseId)
  if (!readiness.exists || !readiness.course) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  const currentStatus = String(readiness.course.status ?? 'draft')

  let nextStatus: string
  if (action === 'submit_review') {
    if (!['draft'].includes(currentStatus)) return json({ error: 'Somente curso em draft pode ser enviado para revisão' }, 409)
    nextStatus = 'review'
  } else if (action === 'publish') {
    if (!auth.roles.some((role) => publisherRoles.has(role))) return json({ error: 'Somente administrador pode publicar curso' }, 403)
    if (currentStatus !== 'review') return json({ error: 'Curso precisa estar em revisão antes de publicar' }, 409)
    if (!readiness.ready) return json({ error: 'Curso ainda não está pronto para publicação', issues: readiness.issues }, 409)
    nextStatus = 'published'
  } else if (action === 'return_draft') {
    if (!auth.roles.some((role) => publisherRoles.has(role))) return json({ error: 'Somente administrador pode devolver curso para rascunho' }, 403)
    if (currentStatus !== 'review') return json({ error: 'Somente curso em revisão pode voltar para draft' }, 409)
    nextStatus = 'draft'
  } else if (action === 'archive') {
    if (!auth.roles.some((role) => publisherRoles.has(role))) return json({ error: 'Somente administrador pode arquivar curso' }, 403)
    if (currentStatus !== 'published') return json({ error: 'Somente curso publicado pode ser arquivado' }, 409)
    nextStatus = 'archived'
  } else {
    return json({ error: 'Ação de publicação inválida' }, 400)
  }

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
