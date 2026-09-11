import { resolvePublicTenant } from '../_publicTenant'
import { dbOr503, json, type Env } from '../_shared'

const SURFACES=new Set(['home','course','path','instructor','event','plan','partner','bundle'])

async function resolveItem(db:any,tenantId:string,row:any){
  const type=String(row.item_type);const ref=String(row.item_ref)
  let item:any=null
  if(type==='course') item=await db.prepare(`SELECT c.id,cp.slug,c.title,COALESCE(cp.short_description,c.description,'') description,cp.category,cp.cover_ref image_ref
    FROM academy_courses c JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
    LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
    LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
    WHERE c.tenant_id=? AND c.id=? AND c.status='published' AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)`).bind(tenantId,ref).first()
  else if(type==='path') item=await db.prepare(`SELECT p.id,p.slug,p.title,COALESCE(p.short_description,p.description,'') description,p.category,p.cover_ref image_ref
    FROM academy_public_learning_paths p WHERE p.tenant_id=? AND p.id=? AND p.visibility='public' AND EXISTS (
      SELECT 1 FROM academy_public_learning_path_courses pc JOIN academy_courses c ON c.id=pc.course_id AND c.tenant_id=pc.tenant_id AND c.status='published'
      JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
      LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=pc.tenant_id AND ws.status='active'
      LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=pc.tenant_id AND wc.course_id=pc.course_id AND wc.visible=1
      WHERE pc.tenant_id=p.tenant_id AND pc.path_id=p.id AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
    )`).bind(tenantId,ref).first()
  else if(type==='instructor') item=await db.prepare(`SELECT p.instructor_id id,p.slug,i.display_name title,COALESCE(p.short_bio,p.headline,'') description,NULL category,p.photo_ref image_ref
    FROM academy_instructor_public_profiles p JOIN academy_instructors i ON i.id=p.instructor_id AND i.tenant_id=p.tenant_id AND i.status='active'
    WHERE p.tenant_id=? AND p.instructor_id=? AND p.visibility='public'`).bind(tenantId,ref).first()
  else if(type==='event') item=await db.prepare(`SELECT id,NULL slug,title,COALESCE(description,'') description,event_type category,NULL image_ref
    FROM academy_events WHERE tenant_id=? AND id=? AND status='published' AND datetime(ends_at)>=datetime('now')`).bind(tenantId,ref).first()
  else if(type==='plan') item=await db.prepare(`SELECT id,slug,name title,COALESCE(description,'') description,audience_type category,NULL image_ref
    FROM academy_plans WHERE tenant_id=? AND id=? AND status='public'`).bind(tenantId,ref).first()
  else if(type==='partner') item=await db.prepare(`SELECT id,slug,display_name title,COALESCE(description,'') description,partner_type category,logo_ref image_ref
    FROM academy_public_partners WHERE tenant_id=? AND id=? AND status='public'`).bind(tenantId,ref).first()
  else if(type==='bundle') item=await db.prepare(`SELECT b.id,b.slug,b.title,COALESCE(b.description,'') description,'bundle' category,b.cover_ref image_ref
    FROM academy_public_bundles b WHERE b.tenant_id=? AND b.id=? AND b.status='public' AND (
      EXISTS (SELECT 1 FROM academy_public_bundle_external_items x WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id)
      OR EXISTS (SELECT 1 FROM academy_public_bundle_paths x JOIN academy_public_learning_paths p ON p.id=x.path_id AND p.tenant_id=x.tenant_id AND p.visibility='public' WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id)
      OR EXISTS (SELECT 1 FROM academy_public_bundle_plans x JOIN academy_plans p ON p.id=x.plan_id AND p.tenant_id=x.tenant_id AND p.status='public' WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id)
      OR EXISTS (SELECT 1 FROM academy_public_bundle_courses x JOIN academy_courses c ON c.id=x.course_id AND c.tenant_id=x.tenant_id AND c.status='published' JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public' LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=x.tenant_id AND ws.status='active' LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=x.tenant_id AND wc.course_id=x.course_id AND wc.visible=1 WHERE x.tenant_id=b.tenant_id AND x.bundle_id=b.id AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL))
    )`).bind(tenantId,ref).first()
  if(!item)return null
  const href=type==='course'?`/courses/${item.slug}`:type==='path'?`/paths/${item.slug}`:type==='instructor'?`/instructors/${item.slug}`:type==='event'?`/events/${item.id}`:type==='plan'?`/plans/${item.slug}`:type==='partner'?`/partners/${item.slug}`:`/bundles/${item.slug}`
  return {type,id:String(item.id),slug:item.slug??null,title:String(item.title),description:String(item.description??''),category:item.category??null,imageRef:item.image_ref??null,href,editorialLabel:row.editorial_label??null,editorialReason:row.editorial_reason??null,position:Number(row.position)}
}

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const db=dbOr503(env);if(db instanceof Response)return db
  const context=await resolvePublicTenant(db,env,request);if(!context)return json({error:'Portal público não configurado para este host'},404)
  const url=new URL(request.url);const surface=String(url.searchParams.get('surface')??'home').trim();const contextRef=surface==='home'?'':String(url.searchParams.get('contextRef')??'').trim()
  if(!SURFACES.has(surface)|| (surface!=='home'&&!contextRef))return json({error:'Contexto editorial inválido'},400)
  const rows=await db.prepare(`SELECT * FROM academy_public_recommendation_sets
    WHERE tenant_id=? AND status='public' AND surface=? AND context_ref=?
      AND (valid_from IS NULL OR datetime(valid_from)<=datetime('now'))
      AND (valid_until IS NULL OR datetime(valid_until)>datetime('now'))
    ORDER BY priority,recommendation_key LIMIT 8`).bind(context.tenantId,surface,contextRef).all()
  const data=[]
  for(const set of rows.results as any[]){
    const itemRows=await db.prepare(`SELECT * FROM academy_public_recommendation_items WHERE tenant_id=? AND set_id=? ORDER BY position LIMIT 20`).bind(context.tenantId,set.id).all()
    const items=[]
    for(const row of itemRows.results as any[]){const resolved=await resolveItem(db,context.tenantId,row);if(resolved)items.push(resolved)}
    if(items.length)data.push({id:set.id,key:set.recommendation_key,title:set.title,subtitle:set.subtitle??'',surface:set.surface,contextRef:set.context_ref,priority:Number(set.priority),items})
  }
  return json({brand:context.brand,data,policy:{strategy:'editorial_curated',behavioralPersonalization:false,commercialProfiling:false,visitorHistoryUsed:false,automaticLeadGeneration:false}})
}
