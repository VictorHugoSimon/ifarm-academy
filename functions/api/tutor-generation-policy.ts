import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { tutorProviderRuntimeStatus } from './_tutorProvider'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const approverRoles = ['academy_admin', 'ifarm_admin']

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, approverRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const courseId = String(body.courseId ?? '').trim()
  if (!courseId || typeof body.enabled !== 'boolean') {
    return json({ error: 'courseId e enabled são obrigatórios' }, 400)
  }
  const enabled = body.enabled === true

  const row = await db.prepare(`
    SELECT c.id, c.title, c.status, c.updated_at,
           p.enabled AS tutor_enabled, p.generative_enabled
    FROM academy_courses c
    LEFT JOIN academy_tutor_course_policies p
      ON p.tenant_id=c.tenant_id AND p.course_id=c.id
    WHERE c.tenant_id=? AND c.id=?
    LIMIT 1
  `).bind(auth.tenantId, courseId).first()
  if (!row) return json({ error: 'Curso não encontrado neste tenant' }, 404)

  const now = new Date().toISOString()
  if (enabled) {
    if (Number(row.tutor_enabled ?? 0) !== 1) {
      return json({ error: 'Autorize primeiro o uso do conteúdo pelo Tutor.' }, 409)
    }
    if (String(row.status) !== 'published') {
      return json({ error: 'A geração externa só pode ser autorizada para a versão atualmente publicada.' }, 409)
    }
    const runtime = tutorProviderRuntimeStatus(env)
    if (!runtime.configured) {
      return json({
        error: 'TUTOR_PROVIDER_NOT_CONFIGURED',
        message: 'O provider server-side não está configurado neste ambiente. A geração externa permanece bloqueada.',
        runtime,
      }, 409)
    }

    await db.batch([
      db.prepare(`
        UPDATE academy_tutor_course_policies
        SET generative_enabled=1,
            generative_approved_by=?,
            generative_approved_at=?,
            generative_approved_course_updated_at=?,
            generative_disabled_at=NULL,
            updated_at=?
        WHERE tenant_id=? AND course_id=? AND enabled=1
      `).bind(auth.userId, now, String(row.updated_at), now, auth.tenantId, courseId),
      auditStatement(db, auth, {
        action: 'tutor.generation.enabled',
        resourceType: 'course',
        resourceId: courseId,
        metadata: {
          providerMode: runtime.mode,
          courseUpdatedAt: String(row.updated_at),
          separateFromContentAuthorization: true,
        },
      }),
    ])

    return json({ data: {
      courseId,
      enabled: true,
      approvedBy: auth.userId,
      approvedAt: now,
      approvedCourseUpdatedAt: String(row.updated_at),
      providerRuntime: runtime,
    }})
  }

  await db.batch([
    db.prepare(`
      UPDATE academy_tutor_course_policies
      SET generative_enabled=0,
          generative_disabled_at=?,
          updated_at=?
      WHERE tenant_id=? AND course_id=?
    `).bind(now, now, auth.tenantId, courseId),
    auditStatement(db, auth, {
      action: 'tutor.generation.disabled',
      resourceType: 'course',
      resourceId: courseId,
      metadata: { courseStatus: row.status },
    }),
  ])

  return json({ data: { courseId, enabled: false, disabledAt: now } })
}
