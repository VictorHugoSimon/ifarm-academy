import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { tryIssueCertificate } from './_certificate'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const courseId = new URL(request.url).searchParams.get('courseId')
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const result = await db.prepare(`
    SELECT * FROM academy_certificates
    WHERE tenant_id=? AND student_id=? AND course_id=?
    ORDER BY issued_at DESC
  `).bind(context.tenantId, context.userId, courseId).all()

  return json({ data: result.results })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const courseId = String(body.courseId ?? '').trim()
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const result = await tryIssueCertificate(db, {
    tenantId: context.tenantId,
    studentId: context.userId,
    studentName: context.displayName ?? null,
    courseId,
  })

  if (!result.issued && !result.idempotent) {
    return json({ error: 'Certificado ainda não elegível', reason: result.reason, details: result.details ?? null }, 409)
  }

  if (result.issued && result.certificate) {
    await auditStatement(db, context, {
      action: 'certificate.issued',
      resourceType: 'certificate',
      resourceId: String(result.certificate.id ?? ''),
      metadata: { source: 'student_request', courseId },
    }).run()
  }

  return json({ data: result.certificate, idempotent: result.idempotent === true }, result.issued ? 201 : 200)
}
