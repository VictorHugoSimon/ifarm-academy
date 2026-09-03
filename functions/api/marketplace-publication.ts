import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { commissionRuleIsEffective } from './_marketplace'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const submissionId = String(body.submissionId ?? '').trim()
  if (!submissionId) return json({ error: 'submissionId é obrigatório' }, 400)

  const submission = await db.prepare(`
    SELECT s.*, c.status AS course_status, c.title AS course_title
    FROM academy_marketplace_submissions s
    JOIN academy_courses c ON c.id=s.course_id AND c.tenant_id=s.tenant_id
    WHERE s.tenant_id=? AND s.id=? LIMIT 1
  `).bind(auth.tenantId, submissionId).first()
  if (!submission) return json({ error: 'Submissão não encontrada neste tenant' }, 404)
  if (String(submission.status) === 'published') return json({ data: { id: submissionId, status: 'published', publishedAt: submission.published_at }, idempotent: true })
  if (String(submission.status) !== 'approved') return json({ error: 'Somente submissão aprovada pode ser publicada no marketplace' }, 409)
  if (String(submission.course_status) !== 'published') return json({ error: 'Curso precisa estar academicamente publicado' }, 409)

  const rule = await db.prepare(`
    SELECT * FROM academy_marketplace_commission_rules
    WHERE tenant_id=? AND submission_id=? AND status='active' LIMIT 1
  `).bind(auth.tenantId, submissionId).first()
  if (!rule) return json({ error: 'Publicação comercial bloqueada: nenhuma regra de comissão ativa foi configurada' }, 409)
  if (!commissionRuleIsEffective(rule as any)) return json({ error: 'Publicação comercial bloqueada: regra de comissão não está vigente' }, 409)

  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`
      UPDATE academy_marketplace_submissions
      SET status='published',published_by=?,published_at=?,updated_at=?
      WHERE tenant_id=? AND id=?
    `).bind(auth.userId, now, now, auth.tenantId, submissionId),
    auditStatement(db, auth, {
      action: 'marketplace.published', resourceType: 'marketplace_submission', resourceId: submissionId,
      metadata: { courseId: submission.course_id, commissionRuleId: rule.id, commissionRuleVersion: Number(rule.version) },
    }),
  ])

  return json({ data: { id: submissionId, status: 'published', publishedAt: now, commissionRuleVersion: Number(rule.version) } })
}
