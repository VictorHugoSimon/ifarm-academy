import { dbOr503, json, safeJson, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const url = new URL(request.url)
  const quizId = url.searchParams.get('quizId')

  let sql = `
    SELECT
      a.*,
      COALESCE(h.questions_json, p.questions_json) AS policy_questions_json,
      COALESCE(h.minimum_score, p.minimum_score) AS policy_minimum_score,
      COALESCE(h.version, p.version) AS resolved_policy_version
    FROM academy_quiz_attempts a
    LEFT JOIN academy_quiz_policy_history h
      ON h.quiz_id = a.quiz_id AND h.version = a.policy_version
    LEFT JOIN academy_quiz_policies p
      ON p.quiz_id = a.quiz_id
    WHERE a.status = 'manual_review'
  `
  const values: string[] = []
  if (quizId) {
    sql += ' AND a.quiz_id = ?'
    values.push(quizId)
  }
  sql += ' ORDER BY a.submitted_at ASC, a.attempt_number ASC'

  const result = await db.prepare(sql).bind(...values).all()
  return json({
    data: result.results.map((row: any) => ({
      id: row.id,
      quizId: row.quiz_id,
      studentId: row.student_id,
      attemptNumber: Number(row.attempt_number),
      status: row.status,
      answers: safeJson(row.answers_json, []),
      automaticResult: safeJson(row.automatic_result_json, null),
      policyVersion: row.resolved_policy_version == null ? null : Number(row.resolved_policy_version),
      minimumScore: Number(row.policy_minimum_score ?? 0),
      questions: safeJson(row.policy_questions_json, []),
      submittedAt: row.submitted_at,
      startedAt: row.started_at,
    })),
  })
}
