import { requireTrustedContext } from './_auth'
import { resolveTenantBrand } from './_whiteLabel'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const brand = await resolveTenantBrand(db, auth.tenantId)
  const domain = await db.prepare(`
    SELECT hostname FROM academy_white_label_domains
    WHERE tenant_id=? AND status='verified' AND is_primary=1 LIMIT 1
  `).bind(auth.tenantId).first()
  return json({ data: { ...brand, primaryDomain: domain?.hostname ?? null } })
}
