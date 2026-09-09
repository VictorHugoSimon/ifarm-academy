import { requireTrustedContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ratings = new Set(['helpful', 'not_helpful'])
const reasons = new Set(['clear_answer', 'useful_source', 'missing_context', 'incorrect_source', 'unclear', 'other'])

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : null
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const messageId = String(body.messageId ?? '').trim()
  const rating = String(body.rating ?? '').trim()
  const reason = optionalText(body.reason, 40)
  const note = optionalText(body.note, 1000)
  if (!messageId || !ratings.has(rating)) return json({ error: 'messageId e rating válido são obrigatórios' }, 400)
  if (reason && !reasons.has(reason)) return json({ error: 'Motivo de feedback inválido' }, 400)

  const message = await db.prepare(`
    SELECT id, session_id
    FROM academy_tutor_messages
    WHERE id=? AND tenant_id=? AND student_id=? AND role='assistant'
    LIMIT 1
  `).bind(messageId, auth.tenantId, auth.userId).first()
  if (!message) return json({ error: 'Resposta do Tutor não encontrada para este aluno' }, 404)

  const now = new Date().toISOString()
  const feedbackId = crypto.randomUUID()
  await db.prepare(`
    INSERT INTO academy_tutor_feedback (
      id, tenant_id, session_id, message_id, student_id,
      rating, reason, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, student_id, message_id) DO UPDATE SET
      rating=excluded.rating,
      reason=excluded.reason,
      note=excluded.note,
      updated_at=excluded.updated_at
  `).bind(
    feedbackId,
    auth.tenantId,
    String(message.session_id),
    messageId,
    auth.userId,
    rating,
    reason,
    note,
    now,
    now,
  ).run()

  const saved = await db.prepare(`
    SELECT id, message_id, rating, reason, note, created_at, updated_at
    FROM academy_tutor_feedback
    WHERE tenant_id=? AND student_id=? AND message_id=?
    LIMIT 1
  `).bind(auth.tenantId, auth.userId, messageId).first()

  return json({ data: saved })
}
