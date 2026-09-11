import { publicSlug } from '../../_publicDiscovery'
import { resolvePublicTenant } from '../../_publicTenant'
import { dbOr503, json, type Env } from '../../_shared'

export const onRequestGet = async ({env,request,params}:{env:Env;request:Request;params:{slug:string}}) => {
  const db=dbOr503(env); if(db instanceof Response)return db
  const context=await resolvePublicTenant(db,env,request); if(!context)return json({error:'Portal público não configurado para este host'},404)
  const slug=publicSlug(params.slug); if(!slug)return json({error:'Parceiro não encontrado'},404)
  const row=await db.prepare(`SELECT id,slug,display_name,description,partner_type,logo_ref,website_url,featured FROM academy_public_partners WHERE tenant_id=? AND slug=? AND status='public' LIMIT 1`).bind(context.tenantId,slug).first()
  if(!row)return json({error:'Parceiro não encontrado'},404)
  const bundles=await db.prepare(`SELECT b.id,b.slug,b.title,b.description,b.commercial_mode,b.list_price_cents,b.currency,b.cover_ref,b.featured
    FROM academy_public_bundle_partners bp JOIN academy_public_bundles b ON b.id=bp.bundle_id AND b.tenant_id=bp.tenant_id
    WHERE bp.tenant_id=? AND bp.partner_id=? AND b.status='public'
      AND (
        EXISTS (SELECT 1 FROM academy_public_bundle_external_items ex WHERE ex.tenant_id=b.tenant_id AND ex.bundle_id=b.id)
        OR EXISTS (SELECT 1 FROM academy_public_bundle_paths px JOIN academy_public_learning_paths p ON p.id=px.path_id AND p.tenant_id=px.tenant_id AND p.visibility='public' WHERE px.tenant_id=b.tenant_id AND px.bundle_id=b.id)
        OR EXISTS (SELECT 1 FROM academy_public_bundle_plans plx JOIN academy_plans pl ON pl.id=plx.plan_id AND pl.tenant_id=plx.tenant_id AND pl.status='public' WHERE plx.tenant_id=b.tenant_id AND plx.bundle_id=b.id)
        OR EXISTS (
          SELECT 1 FROM academy_public_bundle_courses cx
          JOIN academy_courses c ON c.id=cx.course_id AND c.tenant_id=cx.tenant_id AND c.status='published'
          JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
          LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=cx.tenant_id AND ws.status='active'
          LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=cx.tenant_id AND wc.course_id=cx.course_id AND wc.visible=1
          WHERE cx.tenant_id=b.tenant_id AND cx.bundle_id=b.id
            AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
        )
      )
    ORDER BY b.featured DESC,b.title`).bind(context.tenantId,row.id).all()
  return json({brand:context.brand,data:{
    id:row.id,slug:row.slug,displayName:row.display_name,description:row.description??'',partnerType:row.partner_type,
    logoRef:row.logo_ref??null,websiteUrl:row.website_url??null,featured:Number(row.featured)===1,
    bundles:(bundles.results as any[]).map((b)=>({id:b.id,slug:b.slug,title:b.title,description:b.description??'',commercialMode:b.commercial_mode,listPriceCents:b.list_price_cents==null?null:Number(b.list_price_cents),currency:b.currency,coverRef:b.cover_ref??null,featured:Number(b.featured)===1}))
  }})
}
