import { resolvePublicTenant } from '../_publicTenant'
import { dbOr503, json, type Env } from '../_shared'

export const onRequestGet = async ({env,request}:{env:Env;request:Request}) => {
  const db=dbOr503(env); if(db instanceof Response)return db
  const context=await resolvePublicTenant(db,env,request); if(!context)return json({error:'Portal público não configurado para este host'},404)
  const rows=await db.prepare(`SELECT b.*,
    (SELECT COUNT(*) FROM academy_public_bundle_courses x
      JOIN academy_courses c ON c.id=x.course_id AND c.tenant_id=x.tenant_id AND c.status='published'
      JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
      LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=x.tenant_id AND ws.status='active'
      LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=x.tenant_id AND wc.course_id=x.course_id AND wc.visible=1
      WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id
        AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)) AS course_count,
    (SELECT COUNT(*) FROM academy_public_bundle_paths x JOIN academy_public_learning_paths p ON p.id=x.path_id AND p.tenant_id=x.tenant_id AND p.visibility='public' WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id) AS path_count,
    (SELECT COUNT(*) FROM academy_public_bundle_plans x JOIN academy_plans p ON p.id=x.plan_id AND p.tenant_id=x.tenant_id AND p.status='public' WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id) AS plan_count,
    (SELECT COUNT(*) FROM academy_public_bundle_external_items x WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id) AS external_count
    FROM academy_public_bundles b WHERE b.tenant_id=? AND b.status='public' ORDER BY b.featured DESC,b.title`).bind(context.tenantId).all()
  return json({brand:context.brand,data:(rows.results as any[]).map((row)=>({
    id:row.id,slug:row.slug,title:row.title,description:row.description??'',featured:Number(row.featured)===1,
    commercialMode:row.commercial_mode,listPriceCents:row.list_price_cents==null?null:Number(row.list_price_cents),currency:row.currency,
    coverRef:row.cover_ref??null,itemCount:Number(row.course_count)+Number(row.path_count)+Number(row.plan_count)+Number(row.external_count),
  })).filter((row)=>row.itemCount>0)})
}
