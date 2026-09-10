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
    WHERE bp.tenant_id=? AND bp.partner_id=? AND b.status='public' ORDER BY b.featured DESC,b.title`).bind(context.tenantId,row.id).all()
  return json({brand:context.brand,data:{
    id:row.id,slug:row.slug,displayName:row.display_name,description:row.description??'',partnerType:row.partner_type,
    logoRef:row.logo_ref??null,websiteUrl:row.website_url??null,featured:Number(row.featured)===1,
    bundles:(bundles.results as any[]).map((b)=>({id:b.id,slug:b.slug,title:b.title,description:b.description??'',commercialMode:b.commercial_mode,listPriceCents:b.list_price_cents==null?null:Number(b.list_price_cents),currency:b.currency,coverRef:b.cover_ref??null,featured:Number(b.featured)===1}))
  }})
}
