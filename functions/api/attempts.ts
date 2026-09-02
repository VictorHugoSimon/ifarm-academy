import { dbOr503, json, safeJson, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const url = new URL(request.url)
  const quizId = url.searchParams.get('quizId')
  const studentId = url.searchParams.get('studentId')
  if (!quizId || !studentId) return json({ error: 'quizId e studentId são obrigatórios' }, 400)
  const result = await db.prepare(`SELECT * FROM academy_quiz_attempts WHERE quiz_id = ? AND student_id = ? ORDER BY attempt_number`).bind(quizId, studentId).all()
  return json({ data: result.results.map((row: any) => ({ ...row, answers: safeJson(row.answers_json, []), automaticResult: safeJson(row.automatic_result_json, null) })) })
}
