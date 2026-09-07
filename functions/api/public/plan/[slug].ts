import { loadPublicPlans } from '../../_publicPlans'
import { resolvePublicTenant } from '../../_publicTenant'
import { dbOr503, json, type Env } from '../../_shared'

export const onRequestGet = async ({ env, request, params }: { env: Env; request: Request; params: { slug?: string } }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)
  const slug = String(params.slug ?? '').trim().toLowerCase()
  if (!slug) return json({ error: 'Plano não encontrado' }, 404)
  const plans = await loadPublicPlans(db, context.tenantId, slug)
  if (!plans.length) return json({ error: 'Plano não encontrado' }, 404)
  return json({ brand: context.brand, data: plans[0] })
}
