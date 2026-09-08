import { resolvePublicTenant } from '../../_publicTenant'
import { dbOr503, json, type Env } from '../../_shared'

export const onRequestGet = async ({ env, request, params }: { env: Env; request: Request; params: { slug?: string } }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)
  const slug = String(params.slug ?? '').trim()

  const bundle = await db.prepare(`
    SELECT id,slug,title,short_description,description,cover_ref,category,featured,seo_title,seo_description
    FROM academy_public_bundles
    WHERE tenant_id=? AND slug=? AND visibility='public'
    LIMIT 1
  `).bind(context.tenantId, slug).first()
  if (!bundle) return json({ error: 'Bundle não encontrado' }, 404)

  const rows = await db.prepare(`
    SELECT bi.item_type,bi.item_ref,bi.source_system,bi.label,bi.description,bi.position,
      c.title course_title,cp.slug course_slug,cp.category course_category,cp.cover_ref course_cover,
      p.title path_title,p.slug path_slug,p.category path_category,p.cover_ref path_cover,
      pl.name plan_name,pl.slug plan_slug,pl.audience_type plan_audience,
      pp.display_name partner_name,pp.slug partner_slug,pp.logo_ref partner_logo,
      ws.catalog_mode, wc.course_id white_label_course
    FROM academy_public_bundle_items bi
    LEFT JOIN academy_courses c ON bi.item_type='course' AND c.id=bi.item_ref AND c.tenant_id=bi.tenant_id AND c.status='published'
    LEFT JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
    LEFT JOIN academy_public_learning_paths p ON bi.item_type='path' AND p.id=bi.item_ref AND p.tenant_id=bi.tenant_id AND p.visibility='public'
    LEFT JOIN academy_plans pl ON bi.item_type='plan' AND pl.id=bi.item_ref AND pl.tenant_id=bi.tenant_id AND pl.status='public'
    LEFT JOIN academy_public_partner_profiles pp ON bi.item_type='partner' AND pp.id=bi.item_ref AND pp.tenant_id=bi.tenant_id AND pp.visibility='public'
    LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=bi.tenant_id AND ws.status='active'
    LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=bi.tenant_id AND wc.course_id=bi.item_ref AND wc.visible=1
    WHERE bi.tenant_id=? AND bi.bundle_id=?
    ORDER BY bi.position
  `).bind(context.tenantId, bundle.id).all()

  const items = (rows.results as any[]).flatMap((row) => {
    if (row.item_type === 'course') {
      if (!row.course_title || !row.course_slug) return []
      if (row.catalog_mode === 'selected_courses' && !row.white_label_course) return []
      return [{ type:'course', title:row.course_title, slug:row.course_slug, category:row.course_category ?? null, imageRef:row.course_cover ?? null, href:`/courses/${row.course_slug}`, description:row.description ?? '' }]
    }
    if (row.item_type === 'path') {
      if (!row.path_title || !row.path_slug) return []
      return [{ type:'path', title:row.path_title, slug:row.path_slug, category:row.path_category ?? null, imageRef:row.path_cover ?? null, href:`/paths/${row.path_slug}`, description:row.description ?? '' }]
    }
    if (row.item_type === 'plan') {
      if (!row.plan_name || !row.plan_slug) return []
      return [{ type:'plan', title:row.plan_name, slug:row.plan_slug, category:row.plan_audience ?? null, imageRef:null, href:`/plans/${row.plan_slug}`, description:row.description ?? '' }]
    }
    if (row.item_type === 'partner') {
      if (!row.partner_name || !row.partner_slug) return []
      return [{ type:'partner', title:row.partner_name, slug:row.partner_slug, category:null, imageRef:row.partner_logo ?? null, href:`/partners/${row.partner_slug}`, description:row.description ?? '' }]
    }
    if (row.item_type === 'external_reference') {
      return [{ type:'external_reference', title:row.label || 'Benefício do ecossistema', slug:null, category:row.source_system ?? null, imageRef:null, href:null, description:row.description ?? '' }]
    }
    return []
  })

  return json({ brand: context.brand, data: {
    id: bundle.id,
    slug: bundle.slug,
    title: bundle.title,
    shortDescription: bundle.short_description ?? null,
    description: bundle.description ?? '',
    coverRef: bundle.cover_ref ?? null,
    category: bundle.category ?? null,
    featured: Number(bundle.featured) === 1,
    seoTitle: bundle.seo_title ?? null,
    seoDescription: bundle.seo_description ?? null,
    itemCount: items.length,
    items,
    checkoutReady: false,
  } })
}
