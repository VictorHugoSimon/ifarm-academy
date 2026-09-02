import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { normalizeLessonContent, type LessonContent } from './_lessonContent'
import { bodyJson, dbOr503, json, safeJson, type Env } from './_shared'

const contentTypes = new Set([
  'video', 'audio', 'pdf', 'presentation', 'text', 'file', 'link',
  'quiz', 'exercise', 'practical_activity', 'case_study', 'simulation', 'exam',
])

const certificateTypes = new Set([
  'free_course',
  'corporate_training',
  'regulatory_training',
  'partner_certification',
])

interface BuilderLessonInput {
  id: string
  title: string
  contentType: string
  durationMinutes: number
  required: boolean
  position: number
  content: LessonContent
}

interface BuilderModuleInput {
  id: string
  title: string
  description?: string
  position: number
  lessons: BuilderLessonInput[]
}

interface BuilderStateInput {
  courseId: string
  title: string
  instructorLabel: string
  certificateType: string
  modules: BuilderModuleInput[]
  quiz: {
    enabled: boolean
    minimumScore: number
    attemptsAllowed: number
  }
}

function parseBuilderState(value: unknown): BuilderStateInput | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, any>
  const courseId = String(raw.courseId ?? '').trim()
  const title = String(raw.title ?? '').trim()
  const instructorLabel = String(raw.instructorLabel ?? '').trim()
  const certificateType = String(raw.certificateType ?? 'free_course').trim()
  if (!courseId || !title || !certificateTypes.has(certificateType) || !Array.isArray(raw.modules) || !raw.quiz || typeof raw.quiz !== 'object') return null

  const minimumScore = Number(raw.quiz.minimumScore)
  const attemptsAllowed = Number(raw.quiz.attemptsAllowed)
  if (!Number.isFinite(minimumScore) || minimumScore < 0 || minimumScore > 100) return null
  if (!Number.isInteger(attemptsAllowed) || attemptsAllowed <= 0) return null

  const moduleIds = new Set<string>()
  const lessonIds = new Set<string>()
  const modules: BuilderModuleInput[] = []

  for (let moduleIndex = 0; moduleIndex < raw.modules.length; moduleIndex += 1) {
    const source = raw.modules[moduleIndex] as Record<string, any>
    const id = String(source.id ?? '').trim()
    const moduleTitle = String(source.title ?? '').trim()
    if (!id || !moduleTitle || moduleIds.has(id) || !Array.isArray(source.lessons)) return null
    moduleIds.add(id)

    const lessons: BuilderLessonInput[] = []
    for (let lessonIndex = 0; lessonIndex < source.lessons.length; lessonIndex += 1) {
      const lesson = source.lessons[lessonIndex] as Record<string, any>
      const lessonId = String(lesson.id ?? '').trim()
      const lessonTitle = String(lesson.title ?? '').trim()
      const contentType = String(lesson.contentType ?? '')
      const durationMinutes = Number(lesson.durationMinutes)
      if (!lessonId || !lessonTitle || lessonIds.has(lessonId) || !contentTypes.has(contentType)) return null
      if (!Number.isInteger(durationMinutes) || durationMinutes < 0) return null

      const normalizedContent = normalizeLessonContent(lesson.content)
      if (!normalizedContent.ok) return null

      lessonIds.add(lessonId)
      lessons.push({
        id: lessonId,
        title: lessonTitle,
        contentType,
        durationMinutes,
        required: lesson.required !== false,
        position: lessonIndex,
        content: normalizedContent.content,
      })
    }

    modules.push({
      id,
      title: moduleTitle,
      description: String(source.description ?? ''),
      position: moduleIndex,
      lessons,
    })
  }

  return {
    courseId,
    title,
    instructorLabel,
    certificateType,
    modules,
    quiz: {
      enabled: raw.quiz.enabled === true,
      minimumScore,
      attemptsAllowed,
    },
  }
}

const allowedRoles = ['academy_admin', 'academy_instructor', 'instructor', 'ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const courseId = new URL(request.url).searchParams.get('courseId')?.trim() ?? ''
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const course = await db.prepare(`
    SELECT * FROM academy_courses
    WHERE tenant_id=? AND id=?
    LIMIT 1
  `).bind(auth.tenantId, courseId).first()
  if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)

  const modulesResult = await db.prepare(`
    SELECT * FROM academy_course_modules
    WHERE tenant_id=? AND course_id=?
    ORDER BY position, created_at
  `).bind(auth.tenantId, courseId).all()

  const lessonsResult = await db.prepare(`
    SELECT * FROM academy_course_lessons
    WHERE tenant_id=? AND course_id=?
    ORDER BY module_id, position, created_at
  `).bind(auth.tenantId, courseId).all()

  const lessonsByModule = new Map<string, any[]>()
  for (const row of lessonsResult.results as any[]) {
    const moduleId = String(row.module_id)
    const list = lessonsByModule.get(moduleId) ?? []
    list.push({
      id: row.id,
      title: row.title,
      contentType: row.content_type,
      durationMinutes: Number(row.duration_minutes),
      required: Number(row.required) === 1,
      position: Number(row.position),
      content: safeJson(row.content_json, {}),
    })
    lessonsByModule.set(moduleId, list)
  }

  return json({ data: {
    courseId: course.id,
    title: course.title,
    instructorLabel: course.instructor_label ?? '',
    certificateType: course.certificate_type ?? 'free_course',
    modules: (modulesResult.results as any[]).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      position: Number(row.position),
      lessons: lessonsByModule.get(String(row.id)) ?? [],
    })),
    quiz: {
      enabled: Number(course.quiz_enabled) === 1,
      minimumScore: Number(course.minimum_score ?? 0),
      attemptsAllowed: Number(course.attempts_allowed ?? 1),
    },
  }})
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const state = parseBuilderState(body)
  if (!state) return json({ error: 'Estado do Course Builder inválido' }, 400)

  const existingCourse = await db.prepare('SELECT tenant_id, status FROM academy_courses WHERE id=? LIMIT 1')
    .bind(state.courseId).first()
  if (existingCourse && String(existingCourse.tenant_id) !== auth.tenantId) {
    return json({ error: 'courseId já pertence a outro tenant' }, 409)
  }
  if (existingCourse && String(existingCourse.status) !== 'draft') {
    return json({
      error: 'Course Builder bloqueado fora de draft',
      status: existingCourse.status,
      instruction: 'Retorne o curso formalmente para draft antes de editar a estrutura.',
    }, 409)
  }

  const now = new Date().toISOString()
  const statements: any[] = [
    db.prepare(`
      INSERT INTO academy_courses (
        id, tenant_id, title, status, quiz_enabled, minimum_score, attempts_allowed,
        instructor_label, certificate_type,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        quiz_enabled=excluded.quiz_enabled,
        minimum_score=excluded.minimum_score,
        attempts_allowed=excluded.attempts_allowed,
        instructor_label=excluded.instructor_label,
        certificate_type=excluded.certificate_type,
        updated_by=excluded.updated_by,
        updated_at=excluded.updated_at
    `).bind(
      state.courseId,
      auth.tenantId,
      state.title,
      state.quiz.enabled ? 1 : 0,
      state.quiz.minimumScore,
      state.quiz.attemptsAllowed,
      state.instructorLabel || null,
      state.certificateType,
      auth.userId,
      auth.userId,
      now,
      now,
    ),
    db.prepare('DELETE FROM academy_course_lessons WHERE tenant_id=? AND course_id=?')
      .bind(auth.tenantId, state.courseId),
    db.prepare('DELETE FROM academy_course_modules WHERE tenant_id=? AND course_id=?')
      .bind(auth.tenantId, state.courseId),
  ]

  for (const module of state.modules) {
    statements.push(db.prepare(`
      INSERT INTO academy_course_modules (
        id, tenant_id, course_id, title, description, position, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      module.id,
      auth.tenantId,
      state.courseId,
      module.title,
      module.description ?? '',
      module.position,
      now,
      now,
    ))

    for (const lesson of module.lessons) {
      statements.push(db.prepare(`
        INSERT INTO academy_course_lessons (
          id, tenant_id, course_id, module_id, title, content_type,
          duration_minutes, required, position, content_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        lesson.id,
        auth.tenantId,
        state.courseId,
        module.id,
        lesson.title,
        lesson.contentType,
        lesson.durationMinutes,
        lesson.required ? 1 : 0,
        lesson.position,
        JSON.stringify(lesson.content),
        now,
        now,
      ))
    }
  }

  statements.push(auditStatement(db, auth, {
    action: 'course_builder.saved',
    resourceType: 'course',
    resourceId: state.courseId,
    metadata: {
      modules: state.modules.length,
      lessons: state.modules.reduce((sum, module) => sum + module.lessons.length, 0),
      quizEnabled: state.quiz.enabled,
      certificateType: state.certificateType,
      instructorConfigured: Boolean(state.instructorLabel),
    },
  }))

  await db.batch(statements)
  return json({ data: state, savedAt: now })
}
