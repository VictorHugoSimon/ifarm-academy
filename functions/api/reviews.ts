import { requireAdminContext } from './_auth'
import { dbOr503, json, safeJson, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'academy_reviewer', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const url = new URL(request.url)
  const quizId = url.searchParams.get('quizId')
  const studentId = url.searchParams.get('studentId')
  const submittedFrom = url.searchParams.get('submittedFrom')
  const submittedTo = url.searchParams.get('submittedTo')
  const requestedLimit = Number(url.searchParams.get('limit') ?? 50)
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50

  let sql = `
    SELECT
      a.*,
      COALESCE(h.questions_json, p.questions_json) AS policy_questions_json,
      COALESCE(h.minimum_score, p.minimum_score) AS policy_minimum_score,
      COALESCE(h.version, p.version) AS resolved_policy_version
    FROM academy_quiz_attempts a
    LEFT JOIN academy_quiz_policy_history h
      ON h.tenant_id = a.tenant_id
      AND h.quiz_id = a.quiz_id
      AND h.version = a.policy_version
    LEFT JOIN academy_quiz_policies p
      ON p.tenant_id = a.tenant_id
      AND p.quiz_id = a.quiz_id
    WHERE a.tenant_id = ? AND a.status = 'manual_review'
  `
  const values: Array<string | number> = [auth.tenantId]

  if (quizId) {
    sql += ' AND a.quiz_id = ?'
    values.push(quizId)
  }
  if (studentId) {
    sql += ' AND a.student_id = ?'
    values.push(studentId)
  }
  if (submittedFrom) {
    sql += ' AND a.submitted_at >= ?'
    values.push(submittedFrom)
  }
  if (submittedTo) {
    sql += ' AND a.submitted_at <= ?'
    values.push(submittedTo)
  }
  sql += ' ORDER BY a.submitted_at ASC, a.attempt_number ASC LIMIT ?'
  values.push(limit)

  const result = await db.prepare(sql).bind(...values).all()
  return json({
    data: result.results.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      quizId: row.quiz_id,
      studentId: row.student_id,
      studentName: row.student_name_snapshot ?? null,
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
    filters: { quizId, studentId, submittedFrom, submittedTo, limit },
  })
}
