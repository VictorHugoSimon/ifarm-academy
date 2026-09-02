import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const url = new URL(request.url)
  const studentId = url.searchParams.get('studentId')
  const courseId = url.searchParams.get('courseId')
  if (!studentId || !courseId) return json({ error: 'studentId e courseId são obrigatórios' }, 400)
  const result = await db.prepare(`SELECT * FROM academy_certificates WHERE student_id = ? AND course_id = ? ORDER BY issued_at DESC`).bind(studentId, courseId).all()
  return json({ data: result.results })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>; try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const studentId = String(body.studentId ?? ''), courseId = String(body.courseId ?? '')
  const studentName = String(body.studentName ?? ''), courseTitle = String(body.courseTitle ?? '')
  if (!studentId || !courseId || !studentName || !courseTitle) return json({ error: 'studentId, courseId, studentName e courseTitle são obrigatórios' }, 400)

  const existing = await db.prepare(`SELECT * FROM academy_certificates WHERE student_id=? AND course_id=? AND status='valid' LIMIT 1`).bind(studentId, courseId).first()
  if (existing) return json({ data: existing, idempotent: true })

  const policy = await db.prepare(`SELECT * FROM academy_course_completion_policy WHERE course_id=?`).bind(courseId).first()
  if (!policy) return json({ error: 'Política de conclusão não configurada para o curso' }, 409)

  const progress = await db.prepare(`SELECT COUNT(*) AS completed FROM academy_progress WHERE student_id=? AND course_id=? AND progress_percent=100`).bind(studentId, courseId).first()
  const completed = Number(progress?.completed ?? 0)
  if (completed < Number(policy.required_lessons_count ?? 0)) return json({ error: 'Progresso obrigatório incompleto', completed, required: policy.required_lessons_count }, 409)

  let finalScore: number | null = null
  if (Number(policy.assessment_required) === 1) {
    const attempt = await db.prepare(`SELECT * FROM academy_quiz_attempts WHERE quiz_id=? AND student_id=? AND status='approved' ORDER BY attempt_number DESC LIMIT 1`).bind(policy.quiz_id, studentId).first()
    if (!attempt) return json({ error: 'Avaliação obrigatória ainda não aprovada' }, 409)
    finalScore = Number(attempt.final_percentage)
    if (!Number.isFinite(finalScore) || finalScore < Number(policy.minimum_score ?? 0)) return json({ error: 'Nota mínima não atingida' }, 409)
  }

  const id = crypto.randomUUID(), issuedAt = new Date().toISOString()
  const publicCode = `IFA-${issuedAt.slice(0,4)}-${crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase()}`
  await db.prepare(`INSERT INTO academy_certificates (id, public_code, student_id, student_name, course_id, course_title, final_score, issued_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'valid')`).bind(id, publicCode, studentId, studentName, courseId, courseTitle, finalScore, issuedAt).run()
  return json({ data: { id, publicCode, studentId, studentName, courseId, courseTitle, finalScore, issuedAt, status: 'valid' } }, 201)
}
