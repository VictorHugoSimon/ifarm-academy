import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { canTransitionMarketplace } from './_marketplace'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const submissionId = String(body.submissionId ?? '').trim()
  const targetStatus = String(body.targetStatus ?? '').trim()
  const reviewNote = String(body.reviewNote ?? '').trim() || null
  if (!submissionId) return json({ error: 'submissionId é obrigatório' }, 400)
  if (!targetStatus) return json({ error: 'targetStatus é obrigatório' }, 400)

  const submission = await db.prepare(`
    SELECT s.*, c.status AS course_status, c.title AS course_title
    FROM academy_marketplace_submissions s
    JOIN academy_courses c ON c.id=s.course_id AND c.tenant_id=s.tenant_id
    WHERE s.tenant_id=? AND s.id=? LIMIT 1
  `).bind(auth.tenantId, submissionId).first()
  if (!submission) return json({ error: 'Submissão não encontrada neste tenant' }, 404)

  const currentStatus = String(submission.status)
  if (!canTransitionMarketplace(currentStatus, targetStatus)) {
    return json({ error: `Transição ${currentStatus} → ${targetStatus} não permitida` }, 409)
  }
  if (['changes_requested', 'rejected'].includes(targetStatus) && !reviewNote) {
    return json({ error: 'reviewNote é obrigatório para solicitar ajustes ou rejeitar' }, 400)
  }
  if (targetStatus === 'approved' && String(submission.course_status) !== 'published') {
    return json({ error: 'Curso precisa permanecer academicamente publicado para aprovação do marketplace' }, 409)
  }
  if (targetStatus === 'published') {
    return json({ error: 'Publicação comercial deve usar /api/marketplace-publication' }, 409)
  }

  const now = new Date().toISOString()
  const reviewed = ['changes_requested', 'approved', 'rejected'].includes(targetStatus)
  await db.batch([
    db.prepare(`
      UPDATE academy_marketplace_submissions
      SET status=?, review_note=?, reviewed_by=?, reviewed_at=?, updated_at=?
      WHERE tenant_id=? AND id=?
    `).bind(
      targetStatus,
      reviewNote,
      reviewed ? auth.userId : submission.reviewed_by ?? null,
      reviewed ? now : submission.reviewed_at ?? null,
      now,
      auth.tenantId,
      submissionId,
    ),
    auditStatement(db, auth, {
      action: 'marketplace.review_transition',
      resourceType: 'marketplace_submission',
      resourceId: submissionId,
      metadata: { from: currentStatus, to: targetStatus, courseId: submission.course_id, reviewNoteProvided: Boolean(reviewNote) },
    }),
  ])

  return json({ data: { id: submissionId, status: targetStatus, reviewNote, updatedAt: now } })
}
