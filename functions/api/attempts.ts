import { requireTrustedContext } from './_auth'
import { bodyJson, dbOr503, json, safeJson, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const quizId = new URL(request.url).searchParams.get('quizId')?.trim() ?? ''
  if (!quizId) return json({ error: 'quizId é obrigatório' }, 400)

  const policy = await db.prepare(`
    SELECT * FROM academy_quiz_policies
    WHERE tenant_id=? AND quiz_id=? AND status='published'
    LIMIT 1
  `).bind(context.tenantId, quizId).first()
  if (!policy) return json({ error: 'Avaliação não publicada para este tenant' }, 409)
  const courseId = String(policy.course_id ?? '').trim()
  if (!courseId) return json({ error: 'Avaliação não está vinculada a um curso' }, 409)

  const enrollment = await db.prepare(`
    SELECT e.*, lc.cycle_number, lc.status AS cycle_status
    FROM academy_enrollments e
    LEFT JOIN academy_learning_cycles lc ON lc.tenant_id=e.tenant_id AND lc.id=e.active_cycle_id
    WHERE e.tenant_id=? AND e.course_id=? AND e.student_id=? LIMIT 1
  `).bind(context.tenantId, courseId, context.userId).first()
  if (!enrollment || String(enrollment.status) === 'cancelled') return json({ error: 'Matrícula válida é obrigatória' }, 403)
  const cycleId = String(enrollment.active_cycle_id ?? '').trim()
  if (!cycleId) return json({ error: 'Ciclo acadêmico atual não encontrado' }, 409)

  const result = await db.prepare(`
    SELECT * FROM academy_quiz_attempts
    WHERE tenant_id=? AND cycle_id=? AND quiz_id=? AND student_id=?
    ORDER BY attempt_number
  `).bind(context.tenantId, cycleId, quizId, context.userId).all()

  return json({
    data: result.results.map((row: any) => ({
      ...row,
      cycleId: row.cycle_id,
      answers: safeJson(row.answers_json, []),
      automaticResult: safeJson(row.automatic_result_json, null),
    })),
    cycle: { id: cycleId, number: enrollment.cycle_number == null ? null : Number(enrollment.cycle_number), status: enrollment.cycle_status ?? null },
  })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const quizId = String(body.quizId ?? '').trim()
  if (!quizId) return json({ error: 'quizId é obrigatório' }, 400)

  const policy = await db.prepare(`
    SELECT * FROM academy_quiz_policies
    WHERE tenant_id=? AND quiz_id=? AND status='published'
  `).bind(context.tenantId, quizId).first()
  if (!policy) return json({ error: 'Avaliação não publicada para este tenant' }, 409)
  const courseId = String(policy.course_id ?? '').trim()
  if (!courseId) return json({ error: 'Avaliação não está vinculada a um curso' }, 409)

  const enrollment = await db.prepare(`
    SELECT e.*, lc.cycle_number, lc.status AS cycle_status
    FROM academy_enrollments e
    LEFT JOIN academy_learning_cycles lc ON lc.tenant_id=e.tenant_id AND lc.id=e.active_cycle_id
    WHERE e.tenant_id=? AND e.course_id=? AND e.student_id=? LIMIT 1
  `).bind(context.tenantId, courseId, context.userId).first()
  if (!enrollment || String(enrollment.status) === 'cancelled') return json({ error: 'Matrícula válida é obrigatória' }, 403)
  const cycleId = String(enrollment.active_cycle_id ?? '').trim()
  if (!cycleId || String(enrollment.cycle_status ?? '') !== 'active') {
    return json({ error: 'Ciclo acadêmico ativo é obrigatório para iniciar avaliação' }, 409)
  }

  const existing = await db.prepare(`
    SELECT COUNT(*) AS total, MAX(attempt_number) AS last_number
    FROM academy_quiz_attempts
    WHERE tenant_id=? AND cycle_id=? AND quiz_id=? AND student_id=?
  `).bind(context.tenantId, cycleId, quizId, context.userId).first()

  const total = Number(existing?.total ?? 0)
  const allowed = policy.attempts_allowed == null ? null : Number(policy.attempts_allowed)
  if (allowed != null && total >= allowed) {
    return json({ error: 'Limite de tentativas atingido neste ciclo', attemptsAllowed: allowed, attemptsUsed: total, cycleId }, 409)
  }

  const attemptNumber = Number(existing?.last_number ?? 0) + 1
  const id = crypto.randomUUID()
  const startedAt = new Date().toISOString()

  await db.prepare(`
    INSERT INTO academy_quiz_attempts (
      id, cycle_id, quiz_id, student_id, attempt_number, status, answers_json,
      started_at, tenant_id, student_name_snapshot
    ) VALUES (?, ?, ?, ?, ?, 'in_progress', '[]', ?, ?, ?)
  `).bind(id, cycleId, quizId, context.userId, attemptNumber, startedAt, context.tenantId, context.displayName ?? null).run()

  return json({ data: {
    id, cycleId, cycleNumber: enrollment.cycle_number == null ? null : Number(enrollment.cycle_number),
    quizId, courseId, studentId: context.userId, tenantId: context.tenantId,
    attemptNumber, status: 'in_progress', startedAt,
  } }, 201)
}
