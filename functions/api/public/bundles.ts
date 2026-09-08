import { resolvePublicTenant } from '../_publicTenant'
import { dbOr503, json, type Env } from '../_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)

  const rows = await db.prepare(`
    SELECT b.id,b.slug,b.title,b.short_description,b.description,b.cover_ref,b.category,b.featured,
      COUNT(bi.id) AS item_count
    FROM academy_public_bundles b
    JOIN academy_public_bundle_items bi ON bi.tenant_id=b.tenant_id AND bi.bundle_id=b.id
    WHERE b.tenant_id=? AND b.visibility='public'
    GROUP BY b.id
    ORDER BY b.featured DESC,b.title
  `).bind(context.tenantId).all()

  return json({ brand: context.brand, data: (rows.results as any[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description ?? null,
    description: row.description ?? '',
    coverRef: row.cover_ref ?? null,
    category: row.category ?? null,
    featured: Number(row.featured) === 1,
    itemCount: Number(row.item_count ?? 0),
    checkoutReady: false,
  })) })
}
