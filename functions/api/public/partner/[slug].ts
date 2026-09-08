import { resolvePublicTenant } from '../../_publicTenant'
import { dbOr503, json, type Env } from '../../_shared'

export const onRequestGet = async ({ env, request, params }: { env: Env; request: Request; params: { slug?: string } }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)
  const slug = String(params.slug ?? '').trim()

  const row = await db.prepare(`
    SELECT id,slug,display_name,short_description,description,logo_ref,website_url,featured,seo_title,seo_description
    FROM academy_public_partner_profiles
    WHERE tenant_id=? AND slug=? AND visibility='public'
    LIMIT 1
  `).bind(context.tenantId, slug).first()
  if (!row) return json({ error: 'Parceiro não encontrado' }, 404)

  return json({ brand: context.brand, data: {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    shortDescription: row.short_description ?? null,
    description: row.description ?? '',
    logoRef: row.logo_ref ?? null,
    websiteUrl: row.website_url ?? null,
    featured: Number(row.featured) === 1,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
  } })
}
