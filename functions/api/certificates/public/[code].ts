import { dbOr503, json, type Env } from '../../_shared'

export const onRequestGet = async ({ env, params }: { env: Env; params: Record<string,string> }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const code = String(params.code ?? '').trim().toUpperCase()
  if (!code) return json({ error: 'Código obrigatório' }, 400)

  const certificate = await db.prepare(`SELECT public_code, student_name, course_title, final_score, issued_at, status FROM academy_certificates WHERE public_code=? LIMIT 1`).bind(code).first()
  if (!certificate) return json({ valid: false, error: 'Certificado não encontrado' }, 404)

  return json({ valid: String(certificate.status) === 'valid', certificate: {
    publicCode: certificate.public_code,
    studentName: certificate.student_name,
    courseTitle: certificate.course_title,
    finalScore: certificate.final_score,
    issuedAt: certificate.issued_at,
    status: certificate.status,
  } })
}
