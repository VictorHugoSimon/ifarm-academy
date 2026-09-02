export type CourseStatus = 'draft' | 'review' | 'published' | 'archived'
export type CoursePublicationAction = 'submit_review' | 'publish' | 'return_draft' | 'archive'

export interface CourseReadiness {
  exists: boolean
  ready: boolean
  issues: string[]
  course?: Record<string, unknown>
  moduleCount: number
  lessonCount: number
  requiredLessonCount: number
  quizId?: string | null
}

export interface CourseTransitionResult {
  ok: boolean
  nextStatus?: CourseStatus
  error?: string
  publisherRequired?: boolean
  readinessRequired?: boolean
}

export function resolveCourseTransition(
  currentStatus: CourseStatus,
  action: CoursePublicationAction,
): CourseTransitionResult {
  if (action === 'submit_review') {
    if (currentStatus !== 'draft') return { ok: false, error: 'Somente curso em draft pode ser enviado para revisão' }
    return { ok: true, nextStatus: 'review' }
  }

  if (action === 'publish') {
    if (currentStatus !== 'review') return { ok: false, error: 'Curso precisa estar em revisão antes de publicar' }
    return { ok: true, nextStatus: 'published', publisherRequired: true, readinessRequired: true }
  }

  if (action === 'return_draft') {
    if (currentStatus !== 'review') return { ok: false, error: 'Somente curso em revisão pode voltar para draft' }
    return { ok: true, nextStatus: 'draft', publisherRequired: true }
  }

  if (action === 'archive') {
    if (currentStatus !== 'published') return { ok: false, error: 'Somente curso publicado pode ser arquivado' }
    return { ok: true, nextStatus: 'archived', publisherRequired: true }
  }

  return { ok: false, error: 'Ação de publicação inválida' }
}

export async function evaluateCourseReadiness(db: any, tenantId: string, courseId: string): Promise<CourseReadiness> {
  const course = await db.prepare(`
    SELECT * FROM academy_courses
    WHERE tenant_id=? AND id=?
    LIMIT 1
  `).bind(tenantId, courseId).first()

  if (!course) {
    return { exists: false, ready: false, issues: ['Curso não encontrado neste tenant.'], moduleCount: 0, lessonCount: 0, requiredLessonCount: 0 }
  }

  const counts = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM academy_course_modules WHERE tenant_id=? AND course_id=?) AS modules,
      (SELECT COUNT(*) FROM academy_course_lessons WHERE tenant_id=? AND course_id=?) AS lessons,
      (SELECT COUNT(*) FROM academy_course_lessons WHERE tenant_id=? AND course_id=? AND required=1) AS required_lessons
  `).bind(tenantId, courseId, tenantId, courseId, tenantId, courseId).first()

  const moduleCount = Number(counts?.modules ?? 0)
  const lessonCount = Number(counts?.lessons ?? 0)
  const requiredLessonCount = Number(counts?.required_lessons ?? 0)
  const issues: string[] = []

  if (!String(course.title ?? '').trim()) issues.push('Curso sem título.')
  if (moduleCount < 1) issues.push('Curso precisa ter ao menos um módulo.')
  if (lessonCount < 1) issues.push('Curso precisa ter ao menos uma aula.')
  if (requiredLessonCount < 1) issues.push('Curso precisa ter ao menos uma aula obrigatória.')

  let quizId: string | null = null
  if (Number(course.quiz_enabled) === 1) {
    const completion = await db.prepare(`
      SELECT * FROM academy_course_completion_policy
      WHERE tenant_id=? AND course_id=?
      LIMIT 1
    `).bind(tenantId, courseId).first()

    if (!completion) {
      issues.push('Política de conclusão ainda não foi configurada.')
    } else {
      quizId = completion.quiz_id == null ? null : String(completion.quiz_id)
      if (Number(completion.assessment_required) !== 1 || !quizId) {
        issues.push('Curso exige avaliação, mas não possui quiz vinculado na política de conclusão.')
      } else {
        const policy = await db.prepare(`
          SELECT quiz_id FROM academy_quiz_policies
          WHERE tenant_id=? AND quiz_id=? AND status='published'
          LIMIT 1
        `).bind(tenantId, quizId).first()
        if (!policy) issues.push('Quiz vinculado ainda não possui política publicada.')
      }
    }
  }

  return {
    exists: true,
    ready: issues.length === 0,
    issues,
    course,
    moduleCount,
    lessonCount,
    requiredLessonCount,
    quizId,
  }
}
