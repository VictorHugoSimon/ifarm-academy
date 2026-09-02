import { auditStatement } from '../../_audit'
import { requireTrustedContext } from '../../_auth'
import { scoreAssessment, resolveAutomaticStatus, type PolicyQuestion, type SubmittedAnswer } from '../../_assessment'
import { tryIssueCertificate } from '../../_certificate'
import { bodyJson, dbOr503, json, safeJson, type Env } from '../../_shared'

export const onRequestPost = async ({ env, request, params }: { env: Env; request: Request; params: Record<string,string> }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const id = String(params.id ?? '')
  const attempt = await db.prepare(`
    SELECT * FROM academy_quiz_attempts
    WHERE tenant_id=? AND id=? AND student_id=?
  `).bind(context.tenantId, id, context.userId).first()
  if (!attempt) return json({ error: 'Tentativa não encontrada neste tenant' }, 404)
  if (String(attempt.status) !== 'in_progress') return json({ error: 'Tentativa não está em andamento' }, 409)

  const policy = await db.prepare(`
    SELECT * FROM academy_quiz_policies
    WHERE tenant_id=? AND quiz_id=? AND status='published'
  `).bind(context.tenantId, attempt.quiz_id).first()
  if (!policy) return json({ error: 'Política da avaliação indisponível neste tenant' }, 409)

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const answers = Array.isArray(body.answers) ? body.answers as SubmittedAnswer[] : []
  const questions = safeJson(policy.questions_json, []) as PolicyQuestion[]
  if (!questions.length) return json({ error: 'Avaliação sem questões configuradas' }, 409)

  const result = scoreAssessment(questions, answers)
  const minimumScore = Number(policy.minimum_score ?? 0)
  const status = resolveAutomaticStatus(result, minimumScore)
  const submittedAt = new Date().toISOString()
  const policyVersion = Number(policy.version ?? 1)

  await db.batch([
    db.prepare(`
      UPDATE academy_quiz_attempts
      SET status=?, answers_json=?, automatic_result_json=?, final_percentage=?,
          policy_version=?, submitted_at=?, student_name_snapshot=COALESCE(student_name_snapshot, ?)
      WHERE tenant_id=? AND id=? AND student_id=? AND status='in_progress'
    `).bind(
      status,
      JSON.stringify(answers),
      JSON.stringify(result),
      result.percentage,
      policyVersion,
      submittedAt,
      context.displayName ?? null,
      context.tenantId,
      id,
      context.userId,
    ),
    auditStatement(db, context, {
      action: 'quiz_attempt.submitted',
      resourceType: 'quiz_attempt',
      resourceId: id,
      metadata: { quizId: attempt.quiz_id, status, policyVersion, finalPercentage: result.percentage },
    }),
  ])

  let certificate = null
  if (status === 'approved') {
    certificate = await tryIssueCertificate(db, {
      tenantId: context.tenantId,
      studentId: context.userId,
      studentName: context.displayName ?? attempt.student_name_snapshot ?? null,
      quizId: String(attempt.quiz_id),
    })

    if (certificate.issued && certificate.certificate) {
      await auditStatement(db, context, {
        action: 'certificate.auto_issued',
        resourceType: 'certificate',
        resourceId: String(certificate.certificate.id ?? ''),
        metadata: { source: 'automatic_assessment', attemptId: id, quizId: attempt.quiz_id },
      }).run()
    }
  }

  return json({ data: {
    id,
    tenantId: context.tenantId,
    status,
    minimumScore,
    policyVersion,
    automaticResult: result,
    finalPercentage: result.percentage,
    submittedAt,
    certificate,
  }})
}
