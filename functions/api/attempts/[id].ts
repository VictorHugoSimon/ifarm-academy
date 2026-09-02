import { requireTrustedContext } from '../_auth'
import { bodyJson, dbOr503, json, type Env } from '../_shared'

export const onRequestPut = async ({ env, request, params }: { env: Env; request: Request; params: Record<string,string> }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const id = String(params.id ?? '')
  const current = await db.prepare(`
    SELECT * FROM academy_quiz_attempts
    WHERE tenant_id=? AND id=? AND student_id=?
  `).bind(context.tenantId, id, context.userId).first()
  if (!current) return json({ error: 'Tentativa não encontrada neste tenant' }, 404)
  if (String(current.status) !== 'in_progress') {
    return json({ error: 'Somente tentativas em andamento podem salvar rascunho' }, 409)
  }

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  if (!Array.isArray(body.answers)) return json({ error: 'answers é obrigatório' }, 400)

  await db.prepare(`
    UPDATE academy_quiz_attempts
    SET answers_json=?
    WHERE tenant_id=? AND id=? AND student_id=? AND status='in_progress'
  `).bind(JSON.stringify(body.answers), context.tenantId, id, context.userId).run()

  return json({ data: { id, status: 'in_progress', answersSaved: true } })
}
