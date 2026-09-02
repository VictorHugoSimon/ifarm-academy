import { requireTrustedContext } from './_auth'
import { bodyJson, dbOr503, json, safeJson, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const quizId = new URL(request.url).searchParams.get('quizId')
  if (!quizId) return json({ error: 'quizId é obrigatório' }, 400)

  const result = await db.prepare(`
    SELECT * FROM academy_quiz_attempts
    WHERE tenant_id=? AND quiz_id=? AND student_id=?
    ORDER BY attempt_number
  `).bind(context.tenantId, quizId, context.userId).all()

  return json({
    data: result.results.map((row: any) => ({
      ...row,
      answers: safeJson(row.answers_json, []),
      automaticResult: safeJson(row.automatic_result_json, null),
    })),
  })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const quizId = String(body.quizId ?? '')
  if (!quizId) return json({ error: 'quizId é obrigatório' }, 400)

  const policy = await db.prepare(`
    SELECT * FROM academy_quiz_policies
    WHERE tenant_id=? AND quiz_id=? AND status='published'
  `).bind(context.tenantId, quizId).first()
  if (!policy) return json({ error: 'Avaliação não publicada para este tenant' }, 409)

  const existing = await db.prepare(`
    SELECT COUNT(*) AS total, MAX(attempt_number) AS last_number
    FROM academy_quiz_attempts
    WHERE tenant_id=? AND quiz_id=? AND student_id=?
  `).bind(context.tenantId, quizId, context.userId).first()

  const total = Number(existing?.total ?? 0)
  const allowed = policy.attempts_allowed == null ? null : Number(policy.attempts_allowed)
  if (allowed != null && total >= allowed) {
    return json({ error: 'Limite de tentativas atingido', attemptsAllowed: allowed, attemptsUsed: total }, 409)
  }

  const attemptNumber = Number(existing?.last_number ?? 0) + 1
  const id = crypto.randomUUID()
  const startedAt = new Date().toISOString()

  await db.prepare(`
    INSERT INTO academy_quiz_attempts (
      id, quiz_id, student_id, attempt_number, status, answers_json,
      started_at, tenant_id, student_name_snapshot
    ) VALUES (?, ?, ?, ?, 'in_progress', '[]', ?, ?, ?)
  `).bind(
    id,
    quizId,
    context.userId,
    attemptNumber,
    startedAt,
    context.tenantId,
    context.displayName ?? null,
  ).run()

  return json({
    data: {
      id,
      quizId,
      studentId: context.userId,
      tenantId: context.tenantId,
      attemptNumber,
      status: 'in_progress',
      startedAt,
    },
  }, 201)
}
