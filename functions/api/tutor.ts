import { requireTrustedContext } from './_auth'
import { evidenceOnlyMessage, scoreTutorEvidence, type TutorEvidence } from './_tutor'
import { bodyJson, dbOr503, json, type Env } from './_shared'

function clampQuestion(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 2000) : ''
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const sessions = await db.prepare(`
    SELECT id, course_id, title, status, created_at, updated_at
    FROM academy_tutor_sessions
    WHERE tenant_id=? AND student_id=?
    ORDER BY updated_at DESC
    LIMIT 30
  `).bind(auth.tenantId, auth.userId).all()

  return json({ data: sessions.results })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const courseId = String(body.courseId ?? '').trim()
  const question = clampQuestion(body.question)
  const requestedSessionId = String(body.sessionId ?? '').trim()
  if (!courseId || question.length < 3) return json({ error: 'courseId e question são obrigatórios' }, 400)

  const enrollment = await db.prepare(`
    SELECT id, status FROM academy_enrollments
    WHERE tenant_id=? AND student_id=? AND course_id=? AND status IN ('active','completed')
    LIMIT 1
  `).bind(auth.tenantId, auth.userId, courseId).first()
  if (!enrollment) return json({ error: 'Matrícula ativa ou concluída é obrigatória para usar o Tutor neste curso' }, 403)

  const course = await db.prepare(`
    SELECT c.id, c.title, c.status, p.enabled AS tutor_enabled
    FROM academy_courses c
    LEFT JOIN academy_tutor_course_policies p
      ON p.tenant_id=c.tenant_id AND p.course_id=c.id
    WHERE c.tenant_id=? AND c.id=?
    LIMIT 1
  `).bind(auth.tenantId, courseId).first()
  if (!course || String(course.status) !== 'published') return json({ error: 'Curso não disponível para o Tutor' }, 404)
  if (Number(course.tutor_enabled ?? 0) !== 1) {
    return json({ error: 'O Tutor IA não está autorizado para este curso' }, 403)
  }

  let sessionId = requestedSessionId
  if (sessionId) {
    const existing = await db.prepare(`
      SELECT id FROM academy_tutor_sessions
      WHERE id=? AND tenant_id=? AND student_id=? AND course_id=? AND status='active'
      LIMIT 1
    `).bind(sessionId, auth.tenantId, auth.userId, courseId).first()
    if (!existing) return json({ error: 'Sessão do Tutor inválida para este aluno/curso' }, 404)
  } else {
    sessionId = crypto.randomUUID()
  }

  const raw = await db.prepare(`
    SELECT id, course_id, lesson_id, source_title, source_type, content_text
    FROM academy_tutor_source_chunks
    WHERE tenant_id=? AND course_id=?
    ORDER BY lesson_id, chunk_index
    LIMIT 300
  `).bind(auth.tenantId, courseId).all()

  const candidates = (raw.results as any[]).map((row) => ({
    id: String(row.id),
    courseId: String(row.course_id),
    lessonId: String(row.lesson_id),
    sourceTitle: String(row.source_title),
    sourceType: String(row.source_type) as TutorEvidence['sourceType'],
    text: String(row.content_text),
  }))
  const evidence = scoreTutorEvidence(question, candidates).slice(0, 5)
  const answer = evidenceOnlyMessage(evidence)
  const now = new Date().toISOString()
  const citations = evidence.map((item) => ({
    chunkId: item.id,
    lessonId: item.lessonId,
    lessonTitle: item.sourceTitle,
    sourceType: item.sourceType,
    excerpt: item.text.slice(0, 700),
    score: item.score,
  }))

  const userMessageId = crypto.randomUUID()
  const assistantMessageId = crypto.randomUUID()
  const statements: any[] = []
  if (!requestedSessionId) {
    statements.push(db.prepare(`
      INSERT INTO academy_tutor_sessions (
        id, tenant_id, student_id, course_id, title, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(sessionId, auth.tenantId, auth.userId, courseId, question.slice(0, 120), now, now))
  } else {
    statements.push(db.prepare('UPDATE academy_tutor_sessions SET updated_at=? WHERE id=? AND tenant_id=? AND student_id=?')
      .bind(now, sessionId, auth.tenantId, auth.userId))
  }

  statements.push(
    db.prepare(`
      INSERT INTO academy_tutor_messages (
        id, tenant_id, session_id, student_id, role, mode, content_text, citations_json, provider, created_at
      ) VALUES (?, ?, ?, ?, 'user', 'user_input', ?, '[]', NULL, ?)
    `).bind(userMessageId, auth.tenantId, sessionId, auth.userId, question, now),
    db.prepare(`
      INSERT INTO academy_tutor_messages (
        id, tenant_id, session_id, student_id, role, mode, content_text, citations_json, provider, created_at
      ) VALUES (?, ?, ?, ?, 'assistant', ?, ?, ?, NULL, ?)
    `).bind(assistantMessageId, auth.tenantId, sessionId, auth.userId, answer.mode, answer.text, JSON.stringify(citations), now),
  )

  await db.batch(statements)
  return json({
    data: {
      sessionId,
      assistantMessageId,
      courseId,
      courseTitle: course.title,
      mode: answer.mode,
      answer: answer.text,
      citations,
      providerConfigured: false,
    },
  })
}
