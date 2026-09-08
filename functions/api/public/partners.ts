import { resolvePublicTenant } from '../_publicTenant'
import { dbOr503, json, type Env } from '../_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)

  const rows = await db.prepare(`
    SELECT id,slug,display_name,short_description,logo_ref,website_url,featured
    FROM academy_public_partner_profiles
    WHERE tenant_id=? AND visibility='public'
    ORDER BY featured DESC,display_name
  `).bind(context.tenantId).all()

  return json({ brand: context.brand, data: (rows.results as any[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    shortDescription: row.short_description ?? null,
    logoRef: row.logo_ref ?? null,
    websiteUrl: row.website_url ?? null,
    featured: Number(row.featured) === 1,
  })) })
}
