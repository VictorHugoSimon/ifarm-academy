import { scoreAssessment, resolveAutomaticStatus, type PolicyQuestion, type SubmittedAnswer } from '../../_assessment'
import { bodyJson, dbOr503, json, safeJson, type Env } from '../../_shared'

export const onRequestPost = async ({ env, request, params }: { env: Env; request: Request; params: Record<string,string> }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const id = String(params.id ?? '')
  const attempt = await db.prepare(`SELECT * FROM academy_quiz_attempts WHERE id=?`).bind(id).first()
  if (!attempt) return json({ error: 'Tentativa não encontrada' }, 404)
  if (String(attempt.status) !== 'in_progress') return json({ error: 'Tentativa não está em andamento' }, 409)

  const policy = await db.prepare(`SELECT * FROM academy_quiz_policies WHERE quiz_id=? AND status='published'`).bind(attempt.quiz_id).first()
  if (!policy) return json({ error: 'Política da avaliação indisponível' }, 409)

  let body: Record<string, unknown>; try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const answers = Array.isArray(body.answers) ? body.answers as SubmittedAnswer[] : []
  const questions = safeJson(policy.questions_json, []) as PolicyQuestion[]
  if (!questions.length) return json({ error: 'Avaliação sem questões configuradas' }, 409)

  const result = scoreAssessment(questions, answers)
  const minimumScore = Number(policy.minimum_score ?? 0)
  const status = resolveAutomaticStatus(result, minimumScore)
  const submittedAt = new Date().toISOString()
  const policyVersion = Number(policy.version ?? 1)

  await db.prepare(`UPDATE academy_quiz_attempts SET status=?, answers_json=?, automatic_result_json=?, final_percentage=?, policy_version=?, submitted_at=? WHERE id=?`)
    .bind(status, JSON.stringify(answers), JSON.stringify(result), result.percentage, policyVersion, submittedAt, id).run()

  return json({ data: { id, status, minimumScore, policyVersion, automaticResult: result, finalPercentage: result.percentage, submittedAt } })
}
