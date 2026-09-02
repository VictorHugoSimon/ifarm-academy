import { bodyJson, dbOr503, json, safeJson, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const url = new URL(request.url)
  const quizId = url.searchParams.get('quizId')
  const studentId = url.searchParams.get('studentId')
  if (!quizId || !studentId) return json({ error: 'quizId e studentId são obrigatórios' }, 400)
  const result = await db.prepare(`SELECT * FROM academy_quiz_attempts WHERE quiz_id = ? AND student_id = ? ORDER BY attempt_number`).bind(quizId, studentId).all()
  return json({ data: result.results.map((row: any) => ({ ...row, answers: safeJson(row.answers_json, []), automaticResult: safeJson(row.automatic_result_json, null) })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>; try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const quizId = String(body.quizId ?? ''), studentId = String(body.studentId ?? '')
  if (!quizId || !studentId) return json({ error: 'quizId e studentId são obrigatórios' }, 400)

  const policy = await db.prepare(`SELECT * FROM academy_quiz_policies WHERE quiz_id=? AND status='published'`).bind(quizId).first()
  if (!policy) return json({ error: 'Avaliação não publicada ou sem política server-side' }, 409)

  const existing = await db.prepare(`SELECT COUNT(*) AS total, MAX(attempt_number) AS last_number FROM academy_quiz_attempts WHERE quiz_id=? AND student_id=?`).bind(quizId, studentId).first()
  const total = Number(existing?.total ?? 0)
  const allowed = policy.attempts_allowed == null ? null : Number(policy.attempts_allowed)
  if (allowed != null && total >= allowed) return json({ error: 'Limite de tentativas atingido', attemptsAllowed: allowed, attemptsUsed: total }, 409)

  const attemptNumber = Number(existing?.last_number ?? 0) + 1
  const id = crypto.randomUUID(), startedAt = new Date().toISOString()
  await db.prepare(`INSERT INTO academy_quiz_attempts (id, quiz_id, student_id, attempt_number, status, answers_json, started_at) VALUES (?, ?, ?, ?, 'in_progress', '[]', ?)`)
    .bind(id, quizId, studentId, attemptNumber, startedAt).run()
  return json({ data: { id, quizId, studentId, attemptNumber, status: 'in_progress', startedAt } }, 201)
}
