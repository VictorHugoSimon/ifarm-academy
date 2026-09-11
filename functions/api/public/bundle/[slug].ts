import { publicSlug } from '../../_publicDiscovery'
import { resolvePublicTenant } from '../../_publicTenant'
import { dbOr503, json, type Env } from '../../_shared'

export const onRequestGet = async ({env,request,params}:{env:Env;request:Request;params:{slug:string}}) => {
  const db=dbOr503(env); if(db instanceof Response)return db
  const context=await resolvePublicTenant(db,env,request); if(!context)return json({error:'Portal público não configurado para este host'},404)
  const slug=publicSlug(params.slug); if(!slug)return json({error:'Bundle não encontrado'},404)
  const row=await db.prepare("SELECT * FROM academy_public_bundles WHERE tenant_id=? AND slug=? AND status='public' LIMIT 1").bind(context.tenantId,slug).first()
  if(!row)return json({error:'Bundle não encontrado'},404)

  const [courses,paths,plans,external,partners]=await Promise.all([
    db.prepare(`SELECT c.id,c.title,cp.slug,cp.category,cp.cover_ref,x.position
      FROM academy_public_bundle_courses x
      JOIN academy_courses c ON c.id=x.course_id AND c.tenant_id=x.tenant_id AND c.status='published'
      JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
      LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=x.tenant_id AND ws.status='active'
      LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=x.tenant_id AND wc.course_id=x.course_id AND wc.visible=1
      WHERE x.tenant_id=? AND x.bundle_id=? AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
      ORDER BY x.position`).bind(context.tenantId,row.id).all(),
    db.prepare(`SELECT p.id,p.slug,p.title,p.short_description,x.position FROM academy_public_bundle_paths x JOIN academy_public_learning_paths p ON p.id=x.path_id AND p.tenant_id=x.tenant_id AND p.visibility='public' WHERE x.tenant_id=? AND x.bundle_id=? ORDER BY x.position`).bind(context.tenantId,row.id).all(),
    db.prepare(`SELECT p.id,p.slug,p.name,p.description,x.position FROM academy_public_bundle_plans x JOIN academy_plans p ON p.id=x.plan_id AND p.tenant_id=x.tenant_id AND p.status='public' WHERE x.tenant_id=? AND x.bundle_id=? ORDER BY x.position`).bind(context.tenantId,row.id).all(),
    db.prepare(`SELECT source_system,label,description,item_type,position FROM academy_public_bundle_external_items WHERE tenant_id=? AND bundle_id=? ORDER BY position`).bind(context.tenantId,row.id).all(),
    db.prepare(`SELECT p.id,p.slug,p.display_name,p.logo_ref,p.partner_type,x.position FROM academy_public_bundle_partners x JOIN academy_public_partners p ON p.id=x.partner_id AND p.tenant_id=x.tenant_id AND p.status='public' WHERE x.tenant_id=? AND x.bundle_id=? ORDER BY x.position`).bind(context.tenantId,row.id).all(),
  ])

  const visibleItemCount = courses.results.length + paths.results.length + plans.results.length + external.results.length
  if (visibleItemCount === 0) return json({error:'Bundle não encontrado'},404)

  return json({brand:context.brand,data:{
    id:row.id,slug:row.slug,title:row.title,description:row.description??'',featured:Number(row.featured)===1,
    commercialMode:row.commercial_mode,listPriceCents:row.list_price_cents==null?null:Number(row.list_price_cents),currency:row.currency,
    coverRef:row.cover_ref??null,seoTitle:row.seo_title??null,seoDescription:row.seo_description??null,checkoutReady:false,
    courses:(courses.results as any[]).map((x)=>({id:x.id,slug:x.slug,title:x.title,category:x.category??null,coverRef:x.cover_ref??null,position:Number(x.position)})),
    paths:(paths.results as any[]).map((x)=>({id:x.id,slug:x.slug,title:x.title,description:x.short_description??'',position:Number(x.position)})),
    plans:(plans.results as any[]).map((x)=>({id:x.id,slug:x.slug,title:x.name,description:x.description??'',position:Number(x.position)})),
    externalItems:(external.results as any[]).map((x)=>({sourceSystem:x.source_system,label:x.label,description:x.description??'',itemType:x.item_type,position:Number(x.position)})),
    partners:(partners.results as any[]).map((x)=>({id:x.id,slug:x.slug,displayName:x.display_name,logoRef:x.logo_ref??null,partnerType:x.partner_type,position:Number(x.position)})),
  }})
}
