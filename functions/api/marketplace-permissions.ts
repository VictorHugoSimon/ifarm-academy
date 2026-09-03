import { requireTrustedContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const admin = auth.roles.some((role) => ['academy_admin','ifarm_admin'].includes(role))
  const instructor = await db.prepare(`SELECT id FROM academy_instructors WHERE tenant_id=? AND user_id=? AND status='active' LIMIT 1`)
    .bind(auth.tenantId, auth.userId).first()
  return json({ data: {
    canSubmit: Boolean(instructor),
    canReview: admin,
    canConfigureCommission: admin,
    canPublish: admin,
  } })
}
