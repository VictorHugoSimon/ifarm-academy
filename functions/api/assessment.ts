import { requireTrustedContext } from './_auth'
import { dbOr503, json, safeJson, type Env } from './_shared'
import type { PolicyQuestion } from './_assessment'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const quizId = new URL(request.url).searchParams.get('quizId')?.trim() ?? ''
  if (!quizId) return json({ error: 'quizId é obrigatório' }, 400)

  const policy = await db.prepare(`
    SELECT * FROM academy_quiz_policies
    WHERE tenant_id=? AND quiz_id=? AND status='published'
    LIMIT 1
  `).bind(context.tenantId, quizId).first()
  if (!policy) return json({ error: 'Avaliação publicada não encontrada neste tenant' }, 404)

  const courseId = String(policy.course_id ?? '').trim()
  if (!courseId) return json({ error: 'Avaliação não está vinculada a um curso' }, 409)

  const enrollment = await db.prepare(`
    SELECT id, status FROM academy_enrollments
    WHERE tenant_id=? AND course_id=? AND student_id=?
    LIMIT 1
  `).bind(context.tenantId, courseId, context.userId).first()
  if (!enrollment || String(enrollment.status) === 'cancelled') {
    return json({ error: 'Matrícula ativa é obrigatória para acessar a avaliação' }, 403)
  }

  const questions = safeJson(policy.questions_json, []) as PolicyQuestion[]
  if (!questions.length) return json({ error: 'Avaliação sem questões configuradas' }, 409)

  const studentQuestions = questions.map((question) => {
    const prompt = String(question.prompt ?? '').trim()
    const options = Array.isArray(question.options) ? question.options : []
    if (!prompt) return null
    if (question.type !== 'open_answer' && !options.length) return null
    return {
      id: question.id,
      type: question.type,
      prompt,
      points: Number(question.points),
      manualReview: question.manualReview === true || question.type === 'open_answer',
      options: options.map((option) => ({ id: String(option.id), label: String(option.label) })),
    }
  })

  if (studentQuestions.some((question) => question === null)) {
    return json({
      error: 'A política publicada precisa ser republicada para o novo player do aluno',
      code: 'ASSESSMENT_STUDENT_CONTENT_INCOMPLETE',
    }, 409)
  }

  return json({ data: {
    quizId,
    courseId,
    version: Number(policy.version ?? 1),
    minimumScore: Number(policy.minimum_score ?? 0),
    attemptsAllowed: policy.attempts_allowed == null ? null : Number(policy.attempts_allowed),
    randomizeQuestions: Number(policy.randomize_questions) === 1,
    questions: studentQuestions,
  }})
}
