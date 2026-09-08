import { requireTrustedContext } from './_auth'
import { buildEvidenceOnlyTutorAnswer, retrieveTutorEvidence, type TutorEvidenceInput } from './_tutorRetrieval'
import { bodyJson, dbOr503, json, safeJson, type Env } from './_shared'

function text(value: unknown, max = 4000): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized && normalized.length <= max ? normalized : undefined
}

async function requireTutorCourse(db: any, tenantId: string, userId: string, courseId: string) {
  return db.prepare(`
    SELECT c.id, c.title, c.status, e.id AS enrollment_id, e.status AS enrollment_status
    FROM academy_courses c
    JOIN academy_enrollments e
      ON e.tenant_id=c.tenant_id AND e.course_id=c.id
    WHERE c.tenant_id=? AND c.id=? AND e.student_id=?
      AND c.status IN ('published','archived')
      AND e.status IN ('active','completed')
    LIMIT 1
  `).bind(tenantId, courseId, userId).first()
}

async function loadEvidenceInputs(db: any, tenantId: string, courseId: string): Promise<TutorEvidenceInput[]> {
  const rows = await db.prepare(`
    SELECT
      m.id AS module_id, m.title AS module_title,
      l.id AS lesson_id, l.title AS lesson_title, l.content_type, l.content_json
    FROM academy_course_modules m
    JOIN academy_course_lessons l
      ON l.tenant_id=m.tenant_id AND l.course_id=m.course_id AND l.module_id=m.id
    WHERE m.tenant_id=? AND m.course_id=?
    ORDER BY m.position, l.position, l.created_at
  `).bind(tenantId, courseId).all()

  return (rows.results as any[]).map((row) => {
    const content = safeJson(row.content_json, {}) as Record<string, unknown>
    return {
      moduleId: String(row.module_id),
      moduleTitle: String(row.module_title),
      lessonId: String(row.lesson_id),
      lessonTitle: String(row.lesson_title),
      contentType: String(row.content_type),
      body: text(content.body),
      instructions: text(content.instructions),
      label: text(content.label, 500),
    }
  })
}

function mapMessage(row: any) {
  return {
    id: String(row.id),
    role: String(row.role),
    content: String(row.content),
    responseMode: String(row.response_mode),
    citations: safeJson(row.citations_json, []),
    createdAt: String(row.created_at),
  }
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')?.trim() ?? ''
  const courseId = url.searchParams.get('courseId')?.trim() ?? ''

  if (sessionId) {
    const session = await db.prepare(`
      SELECT * FROM academy_tutor_sessions
      WHERE id=? AND tenant_id=? AND user_id=? LIMIT 1
    `).bind(sessionId, auth.tenantId, auth.userId).first()
    if (!session) return json({ error: 'Sessão do Tutor IA não encontrada' }, 404)

    const messages = await db.prepare(`
      SELECT * FROM academy_tutor_messages
      WHERE session_id=? AND tenant_id=? AND user_id=?
      ORDER BY created_at, id
    `).bind(sessionId, auth.tenantId, auth.userId).all()

    return json({ data: {
      session: {
        id: String(session.id),
        courseId: String(session.course_id),
        status: String(session.status),
        createdAt: String(session.created_at),
        updatedAt: String(session.updated_at),
      },
      messages: (messages.results as any[]).map(mapMessage),
    } })
  }

  if (!courseId) return json({ error: 'courseId ou sessionId é obrigatório' }, 400)
  const course = await requireTutorCourse(db, auth.tenantId, auth.userId, courseId)
  if (!course) return json({ error: 'Curso não disponível para o Tutor IA nesta matrícula' }, 403)

  const sessions = await db.prepare(`
    SELECT id, course_id, status, created_at, updated_at, last_message_at
    FROM academy_tutor_sessions
    WHERE tenant_id=? AND user_id=? AND course_id=?
    ORDER BY updated_at DESC
    LIMIT 20
  `).bind(auth.tenantId, auth.userId, courseId).all()

  return json({ data: (sessions.results as any[]).map((row) => ({
    id: String(row.id),
    courseId: String(row.course_id),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastMessageAt: String(row.last_message_at),
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) }
  catch { return json({ error: 'JSON inválido' }, 400) }

  const courseId = text(body.courseId, 160) ?? ''
  const question = text(body.question, 1000) ?? ''
  const requestedSessionId = text(body.sessionId, 160)
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)
  if (question.length < 3) return json({ error: 'A pergunta deve ter ao menos 3 caracteres' }, 400)

  const course = await requireTutorCourse(db, auth.tenantId, auth.userId, courseId)
  if (!course) return json({ error: 'Curso não disponível para o Tutor IA nesta matrícula' }, 403)

  const now = new Date().toISOString()
  let sessionId = requestedSessionId
  if (sessionId) {
    const existing = await db.prepare(`
      SELECT id FROM academy_tutor_sessions
      WHERE id=? AND tenant_id=? AND user_id=? AND course_id=? AND status='active' LIMIT 1
    `).bind(sessionId, auth.tenantId, auth.userId, courseId).first()
    if (!existing) return json({ error: 'Sessão do Tutor IA inválida para este curso' }, 404)
  } else {
    sessionId = crypto.randomUUID()
    await db.prepare(`
      INSERT INTO academy_tutor_sessions
        (id,tenant_id,user_id,course_id,status,created_at,updated_at,last_message_at)
      VALUES (?,?,?,?, 'active',?,?,?)
    `).bind(sessionId, auth.tenantId, auth.userId, courseId, now, now, now).run()
  }

  const inputs = await loadEvidenceInputs(db, auth.tenantId, courseId)
  const citations = retrieveTutorEvidence(question, inputs, 5)
  const answer = buildEvidenceOnlyTutorAnswer(citations)

  await db.prepare(`
    INSERT INTO academy_tutor_messages
      (id,session_id,tenant_id,user_id,course_id,role,content,response_mode,citations_json,created_at)
    VALUES (?,?,?,?,?,'user',?,'evidence_only','[]',?)
  `).bind(crypto.randomUUID(), sessionId, auth.tenantId, auth.userId, courseId, question, now).run()

  const assistantAt = new Date().toISOString()
  const assistantId = crypto.randomUUID()
  await db.prepare(`
    INSERT INTO academy_tutor_messages
      (id,session_id,tenant_id,user_id,course_id,role,content,response_mode,citations_json,created_at)
    VALUES (?,?,?,?,?,'assistant',?,'evidence_only',?,?)
  `).bind(assistantId, sessionId, auth.tenantId, auth.userId, courseId, answer, JSON.stringify(citations), assistantAt).run()

  await db.prepare(`
    UPDATE academy_tutor_sessions SET updated_at=?, last_message_at=?
    WHERE id=? AND tenant_id=? AND user_id=?
  `).bind(assistantAt, assistantAt, sessionId, auth.tenantId, auth.userId).run()

  return json({ data: {
    sessionId,
    courseId,
    courseTitle: String(course.title),
    responseMode: 'evidence_only',
    answer,
    citations,
    insufficientEvidence: citations.length === 0,
    messageId: assistantId,
    createdAt: assistantAt,
  } })
}
