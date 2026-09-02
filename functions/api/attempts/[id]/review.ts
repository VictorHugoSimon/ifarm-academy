import { requireAdminContext } from '../../_auth'
import { resolveManualReview, type AutomaticAssessmentResult, type ManualReviewItem, type PolicyQuestion } from '../../_assessment'
import { bodyJson, dbOr503, json, safeJson, type Env } from '../../_shared'

export const onRequestPost = async ({ env, request, params }: { env: Env; request: Request; params: Record<string, string> }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'academy_reviewer', 'ifarm_admin'])
  if (auth instanceof Response) return auth

  const db = dbOr503(env); if (db instanceof Response) return db
  const id = String(params.id ?? '')
  const attempt = await db.prepare(`SELECT * FROM academy_quiz_attempts WHERE id=?`).bind(id).first()
  if (!attempt) return json({ error: 'Tentativa não encontrada' }, 404)
  if (String(attempt.status) !== 'manual_review') return json({ error: 'Tentativa não está aguardando revisão manual' }, 409)

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const reviewerId = auth.userId
  const reviewerName = String(body.reviewerName ?? '').trim() || reviewerId
  const reviewNote = String(body.reviewNote ?? '').trim()
  const reviews = Array.isArray(body.reviews) ? body.reviews as ManualReviewItem[] : []
  if (!reviews.length) return json({ error: 'reviews é obrigatório' }, 400)

  const version = attempt.policy_version == null ? null : Number(attempt.policy_version)
  let policy: any = null
  if (version != null) {
    policy = await db.prepare(`SELECT * FROM academy_quiz_policy_history WHERE quiz_id=? AND version=?`).bind(attempt.quiz_id, version).first()
  }
  if (!policy) {
    policy = await db.prepare(`SELECT * FROM academy_quiz_policies WHERE quiz_id=? AND status='published'`).bind(attempt.quiz_id).first()
  }
  if (!policy) return json({ error: 'Política versionada da avaliação indisponível' }, 409)

  const questions = safeJson(policy.questions_json, []) as PolicyQuestion[]
  const automaticResult = safeJson(attempt.automatic_result_json, null) as AutomaticAssessmentResult | null
  if (!automaticResult) return json({ error: 'Resultado automático indisponível' }, 409)

  let result
  try {
    result = resolveManualReview(automaticResult, questions, reviews, Number(policy.minimum_score ?? 0))
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Revisão manual inválida' }, 400)
  }

  const reviewedAt = new Date().toISOString()
  const reviewMap = new Map(reviews.map((item) => [item.questionId, item]))
  const statements = result.reviewedQuestionIds.map((questionId) => {
    const question = questions.find((item) => item.id === questionId)!
    const review = reviewMap.get(questionId)!
    return db.prepare(`
      INSERT INTO academy_quiz_attempt_reviews (
        id, attempt_id, question_id, reviewer_id, reviewer_name,
        awarded_points, max_points, note, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), id, questionId, reviewerId, reviewerName,
      Number(review.awardedPoints), Math.max(0, Number(question.points) || 0), review.note ?? null, reviewedAt
    )
  })

  statements.push(db.prepare(`
    UPDATE academy_quiz_attempts
    SET status=?, manual_points=?, manual_total_points=?, final_percentage=?,
        reviewed_at=?, reviewer_name=?, review_note=?
    WHERE id=? AND status='manual_review'
  `).bind(
    result.status, result.manualPoints, result.manualTotalPoints, result.finalPercentage,
    reviewedAt, reviewerName, reviewNote || null, id
  ))

  await db.batch(statements)

  return json({ data: {
    id,
    status: result.status,
    finalPercentage: result.finalPercentage,
    manualPoints: result.manualPoints,
    manualTotalPoints: result.manualTotalPoints,
    reviewedQuestionIds: result.reviewedQuestionIds,
    reviewerId,
    reviewerName,
    reviewedAt,
  }})
}
