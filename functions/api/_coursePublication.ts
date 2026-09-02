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
