import { resolvePublicTenant } from '../_publicTenant'
import { dbOr503, json, type Env } from '../_shared'

export const onRequestGet = async ({env,request}:{env:Env;request:Request}) => {
  const db=dbOr503(env); if(db instanceof Response)return db
  const context=await resolvePublicTenant(db,env,request); if(!context)return json({error:'Portal público não configurado para este host'},404)
  const rows=await db.prepare(`SELECT b.*,
    (SELECT COUNT(*) FROM academy_public_bundle_courses x WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id) AS course_count,
    (SELECT COUNT(*) FROM academy_public_bundle_paths x WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id) AS path_count,
    (SELECT COUNT(*) FROM academy_public_bundle_plans x WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id) AS plan_count,
    (SELECT COUNT(*) FROM academy_public_bundle_external_items x WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id) AS external_count
    FROM academy_public_bundles b WHERE b.tenant_id=? AND b.status='public' ORDER BY b.featured DESC,b.title`).bind(context.tenantId).all()
  return json({brand:context.brand,data:(rows.results as any[]).map((row)=>({
    id:row.id,slug:row.slug,title:row.title,description:row.description??'',featured:Number(row.featured)===1,
    commercialMode:row.commercial_mode,listPriceCents:row.list_price_cents==null?null:Number(row.list_price_cents),currency:row.currency,
    coverRef:row.cover_ref??null,itemCount:Number(row.course_count)+Number(row.path_count)+Number(row.plan_count)+Number(row.external_count),
  }))})
}
