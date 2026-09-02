import { requireTrustedContext } from './_auth'
import { publicMediaContent } from './_media'
import { dbOr503, json, safeJson, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const courseId = new URL(request.url).searchParams.get('courseId')?.trim() ?? ''
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const enrollment = await db.prepare(`
    SELECT e.*, lc.status AS cycle_status, lc.cycle_number, lc.source AS cycle_source,
      lc.started_at AS cycle_started_at, lc.completed_at AS cycle_completed_at, lc.due_at AS cycle_due_at
    FROM academy_enrollments e
    LEFT JOIN academy_learning_cycles lc ON lc.tenant_id=e.tenant_id AND lc.id=e.active_cycle_id
    WHERE e.tenant_id=? AND e.course_id=? AND e.student_id=? LIMIT 1
  `).bind(context.tenantId, courseId, context.userId).first()
  if (!enrollment) return json({ error: 'Matrícula não encontrada' }, 403)
  if (String(enrollment.status) === 'cancelled') return json({ error: 'Matrícula cancelada' }, 403)
  const cycleId = String(enrollment.active_cycle_id ?? '').trim()
  if (!cycleId) return json({ error: 'Ciclo acadêmico atual não encontrado' }, 409)

  const course = await db.prepare(`SELECT * FROM academy_courses WHERE tenant_id=? AND id=? LIMIT 1`)
    .bind(context.tenantId, courseId).first()
  if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  if (!['published', 'archived'].includes(String(course.status))) return json({ error: 'Curso ainda não está disponível para consumo' }, 409)

  const modules = await db.prepare(`SELECT * FROM academy_course_modules WHERE tenant_id=? AND course_id=? ORDER BY position, created_at`)
    .bind(context.tenantId, courseId).all()
  const lessons = await db.prepare(`SELECT * FROM academy_course_lessons WHERE tenant_id=? AND course_id=? ORDER BY module_id, position, created_at`)
    .bind(context.tenantId, courseId).all()
  const progress = await db.prepare(`
    SELECT * FROM academy_progress
    WHERE tenant_id=? AND course_id=? AND student_id=? AND cycle_id=?
  `).bind(context.tenantId, courseId, context.userId, cycleId).all()
  const policy = await db.prepare(`SELECT * FROM academy_course_completion_policy WHERE tenant_id=? AND course_id=? LIMIT 1`)
    .bind(context.tenantId, courseId).first()

  const progressByLesson = new Map((progress.results as any[]).map((row) => [String(row.lesson_id), row]))
  const lessonsByModule = new Map<string, any[]>()
  let requiredLessons = 0
  let completedRequiredLessons = 0

  for (const row of lessons.results as any[]) {
    const lessonId = String(row.id)
    const progressRow: any = progressByLesson.get(lessonId)
    const required = Number(row.required) === 1
    if (required) {
      requiredLessons += 1
      if (Number(progressRow?.progress_percent ?? 0) >= 100) completedRequiredLessons += 1
    }
    const moduleId = String(row.module_id)
    const list = lessonsByModule.get(moduleId) ?? []
    const contentType = String(row.content_type)
    const rawContent = safeJson(row.content_json, {})
    const content = ['video', 'audio'].includes(contentType) ? publicMediaContent(rawContent) : rawContent
    list.push({
      id: lessonId,
      moduleId,
      title: row.title,
      contentType,
      durationMinutes: Number(row.duration_minutes ?? 0),
      required,
      position: Number(row.position ?? 0),
      content,
      progressPercent: Number(progressRow?.progress_percent ?? 0),
      lastPositionSeconds: Number(progressRow?.last_position_seconds ?? 0),
      completedAt: progressRow?.completed_at ?? null,
    })
    lessonsByModule.set(moduleId, list)
  }

  const overallProgressPercent = requiredLessons > 0 ? Math.round((completedRequiredLessons / requiredLessons) * 100) : 0

  return json({ data: {
    course: { id: course.id, title: course.title, description: course.description ?? '', status: course.status },
    enrollment: {
      id: enrollment.id,
      status: enrollment.status,
      activeCycleId: cycleId,
      cycleNumber: enrollment.cycle_number == null ? null : Number(enrollment.cycle_number),
      cycleStatus: enrollment.cycle_status ?? null,
      cycleSource: enrollment.cycle_source ?? null,
      cycleStartedAt: enrollment.cycle_started_at ?? null,
      cycleCompletedAt: enrollment.cycle_completed_at ?? null,
      cycleDueAt: enrollment.cycle_due_at ?? null,
      enrolledAt: enrollment.enrolled_at,
      completedAt: enrollment.completed_at ?? null,
    },
    modules: (modules.results as any[]).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      position: Number(row.position ?? 0),
      lessons: lessonsByModule.get(String(row.id)) ?? [],
    })),
    completion: {
      overallProgressPercent,
      requiredLessons,
      completedRequiredLessons,
      assessmentRequired: Number(policy?.assessment_required ?? 0) === 1,
      quizId: policy?.quiz_id == null ? null : String(policy.quiz_id),
      minimumScore: policy?.minimum_score == null ? null : Number(policy.minimum_score),
    },
  } })
}
