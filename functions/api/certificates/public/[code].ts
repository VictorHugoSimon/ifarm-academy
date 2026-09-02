import { dbOr503, json, type Env } from '../../_shared'

export const onRequestGet = async ({ env, params }: { env: Env; params: Record<string,string> }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const code = String(params.code ?? '').trim().toUpperCase()
  if (!code) return json({ error: 'Código obrigatório' }, 400)

  const certificate = await db.prepare(`
    SELECT
      public_code, student_name, course_title, final_score, issued_at, status,
      workload_minutes, instructor_label, certificate_type, completion_date,
      metadata_version
    FROM academy_certificates
    WHERE public_code=?
    LIMIT 1
  `).bind(code).first()
  if (!certificate) return json({ valid: false, error: 'Certificado não encontrado' }, 404)

  return json({
    valid: String(certificate.status) === 'valid',
    certificate: {
      publicCode: certificate.public_code,
      studentName: certificate.student_name,
      courseTitle: certificate.course_title,
      finalScore: certificate.final_score == null ? null : Number(certificate.final_score),
      issuedAt: certificate.issued_at,
      status: certificate.status,
      workloadMinutes: Number(certificate.workload_minutes ?? 0),
      instructorLabel: certificate.instructor_label ?? null,
      certificateType: certificate.certificate_type ?? 'free_course',
      completionDate: certificate.completion_date ?? certificate.issued_at,
      metadataVersion: Number(certificate.metadata_version ?? 1),
    },
  })
}
