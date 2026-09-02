import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, safeJson, type Env } from './_shared'
import type { PolicyQuestion } from './_assessment'

function validateQuestions(value: unknown): PolicyQuestion[] | null {
  if (!Array.isArray(value) || !value.length) return null
  const questions = value as PolicyQuestion[]
  const ids = new Set<string>()
  for (const question of questions) {
    if (!question || typeof question.id !== 'string' || !question.id.trim()) return null
    if (ids.has(question.id)) return null
    ids.add(question.id)
    if (!['multiple_choice', 'true_false', 'open_answer'].includes(question.type)) return null
    if (!Number.isFinite(Number(question.points)) || Number(question.points) < 0) return null
    if (question.type !== 'open_answer' && !Array.isArray(question.correctOptionIds)) return null
  }
  return questions
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth

  const db = dbOr503(env); if (db instanceof Response) return db
  const quizId = new URL(request.url).searchParams.get('quizId')
  if (!quizId) return json({ error: 'quizId é obrigatório' }, 400)

  const current = await db.prepare(`SELECT * FROM academy_quiz_policies WHERE quiz_id=?`).bind(quizId).first()
  const history = await db.prepare(`SELECT * FROM academy_quiz_policy_history WHERE quiz_id=? ORDER BY version DESC`).bind(quizId).all()

  return json({
    data: {
      current: current ? { ...current, questions: safeJson(current.questions_json, []), questions_json: undefined } : null,
      history: history.results.map((row: any) => ({ ...row, questions: safeJson(row.questions_json, []), questions_json: undefined })),
    },
    actor: { userId: auth.userId, tenantId: auth.tenantId, roles: auth.roles },
  })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth

  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const quizId = String(body.quizId ?? '').trim()
  const actorId = auth.userId
  const courseId = body.courseId == null ? null : String(body.courseId)
  const minimumScore = Number(body.minimumScore ?? 0)
  const attemptsAllowed = body.attemptsAllowed == null ? null : Number(body.attemptsAllowed)
  const randomizeQuestions = body.randomizeQuestions === true ? 1 : 0
  const questions = validateQuestions(body.questions)

  if (!quizId) return json({ error: 'quizId é obrigatório' }, 400)
  if (!Number.isFinite(minimumScore) || minimumScore < 0 || minimumScore > 100) return json({ error: 'minimumScore deve estar entre 0 e 100' }, 400)
  if (attemptsAllowed != null && (!Number.isInteger(attemptsAllowed) || attemptsAllowed <= 0)) return json({ error: 'attemptsAllowed deve ser inteiro positivo ou null' }, 400)
  if (!questions) return json({ error: 'questions deve conter questões válidas e IDs únicos' }, 400)

  const current: any = await db.prepare(`SELECT * FROM academy_quiz_policies WHERE quiz_id=?`).bind(quizId).first()
  const now = new Date().toISOString()
  const statements: any[] = []

  if (current && String(current.status) === 'published') {
    const exists = await db.prepare(`SELECT id FROM academy_quiz_policy_history WHERE quiz_id=? AND version=?`).bind(quizId, Number(current.version ?? 1)).first()
    if (!exists) {
      statements.push(db.prepare(`
        INSERT INTO academy_quiz_policy_history (
          id, quiz_id, course_id, version, minimum_score, attempts_allowed,
          randomize_questions, questions_json, published_by, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(), quizId, current.course_id ?? null, Number(current.version ?? 1),
        Number(current.minimum_score ?? 0), current.attempts_allowed == null ? null : Number(current.attempts_allowed),
        Number(current.randomize_questions ?? 0), String(current.questions_json ?? '[]'),
        'system-backfill', String(current.published_at ?? current.updated_at ?? now)
      ))
    }
  }

  const nextVersion = current ? Number(current.version ?? 1) + 1 : 1
  const questionsJson = JSON.stringify(questions)

  statements.push(db.prepare(`
    INSERT INTO academy_quiz_policy_history (
      id, quiz_id, course_id, version, minimum_score, attempts_allowed,
      randomize_questions, questions_json, published_by, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), quizId, courseId, nextVersion, minimumScore, attemptsAllowed,
    randomizeQuestions, questionsJson, actorId, now
  ))

  statements.push(db.prepare(`
    INSERT INTO academy_quiz_policies (
      quiz_id, course_id, status, minimum_score, attempts_allowed,
      randomize_questions, questions_json, version, published_at, updated_at
    ) VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(quiz_id) DO UPDATE SET
      course_id=excluded.course_id,
      status='published',
      minimum_score=excluded.minimum_score,
      attempts_allowed=excluded.attempts_allowed,
      randomize_questions=excluded.randomize_questions,
      questions_json=excluded.questions_json,
      version=excluded.version,
      published_at=excluded.published_at,
      updated_at=excluded.updated_at
  `).bind(
    quizId, courseId, minimumScore, attemptsAllowed, randomizeQuestions,
    questionsJson, nextVersion, now, now
  ))

  await db.batch(statements)

  return json({ data: {
    quizId,
    courseId,
    status: 'published',
    version: nextVersion,
    minimumScore,
    attemptsAllowed,
    randomizeQuestions: randomizeQuestions === 1,
    publishedBy: actorId,
    publishedAt: now,
  }}, 201)
}
