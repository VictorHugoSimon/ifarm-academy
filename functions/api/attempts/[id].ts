import { allowedAttemptTransitions, bodyJson, dbOr503, json, type Env } from '../_shared'

export const onRequestPut = async ({ env, request, params }: { env: Env; request: Request; params: Record<string,string> }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const id = String(params.id ?? '')
  const current = await db.prepare(`SELECT * FROM academy_quiz_attempts WHERE id = ?`).bind(id).first()
  if (!current) return json({ error: 'Tentativa não encontrada' }, 404)
  let body: Record<string, unknown>; try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  for (const field of ['studentId','quizId','attemptNumber']) {
    const map: Record<string,string> = { studentId: 'student_id', quizId: 'quiz_id', attemptNumber: 'attempt_number' }
    if (body[field] != null && String(body[field]) !== String(current[map[field]])) return json({ error: `${field} é imutável` }, 409)
  }

  const nextStatus = String(body.status ?? current.status)
  if (nextStatus !== current.status && !(allowedAttemptTransitions[String(current.status)] ?? []).includes(nextStatus)) {
    return json({ error: `Transição inválida: ${current.status} → ${nextStatus}` }, 409)
  }

  const answersJson = JSON.stringify(body.answers ?? JSON.parse(String(current.answers_json ?? '[]')))
  const automaticJson = body.automaticResult === undefined ? current.automatic_result_json : JSON.stringify(body.automaticResult)
  const finalPercentage = body.finalPercentage == null ? current.final_percentage : Number(body.finalPercentage)
  if (finalPercentage != null && (!Number.isFinite(finalPercentage) || finalPercentage < 0 || finalPercentage > 100)) return json({ error: 'finalPercentage inválido' }, 400)

  await db.prepare(`UPDATE academy_quiz_attempts SET status=?, answers_json=?, automatic_result_json=?, manual_points=?, manual_total_points=?, final_percentage=?, submitted_at=?, reviewed_at=?, reviewer_name=?, review_note=? WHERE id=?`)
    .bind(nextStatus, answersJson, automaticJson, body.manualPoints ?? current.manual_points, body.manualTotalPoints ?? current.manual_total_points, finalPercentage, body.submittedAt ?? current.submitted_at, body.reviewedAt ?? current.reviewed_at, body.reviewerName ?? current.reviewer_name, body.reviewNote ?? current.review_note, id).run()
  return json({ data: { id, status: nextStatus, finalPercentage } })
}
