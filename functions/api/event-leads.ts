import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const STAGES=['new','qualified','contacted','converted','discarded']

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin'])
  if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  const url=new URL(request.url)
  const eventId=url.searchParams.get('eventId')?.trim()??''
  const stage=url.searchParams.get('stage')?.trim()??''
  if(stage&&!STAGES.includes(stage))return json({error:'stage inválido'},400)
  const rows=await db.prepare(`
    SELECT l.*,e.title AS event_title,r.display_name_snapshot
    FROM academy_event_commercial_leads l
    JOIN academy_events e ON e.tenant_id=l.tenant_id AND e.id=l.event_id
    JOIN academy_event_registrations r ON r.tenant_id=l.tenant_id AND r.id=l.registration_id
    WHERE l.tenant_id=? AND (?='' OR l.event_id=?) AND (?='' OR l.stage=?)
    ORDER BY l.created_at DESC
  `).bind(auth.tenantId,eventId,eventId,stage,stage).all()
  return json({data:(rows.results as any[]).map((row)=>({
    id:row.id,eventId:row.event_id,eventTitle:row.event_title,registrationId:row.registration_id,
    userId:row.user_id,displayName:row.display_name_snapshot,companyId:row.company_id??null,
    interestCode:row.interest_code,origin:row.origin,consentSource:row.consent_source,
    consentRecordedAt:row.consent_recorded_at,stage:row.stage,createdAt:row.created_at,updatedAt:row.updated_at,
  }))})
}

export const onRequestPut=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin'])
  if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const leadId=String(body.leadId??'').trim(),stage=String(body.stage??'').trim()
  if(!leadId||!STAGES.includes(stage))return json({error:'leadId ou stage inválido'},400)
  const current=await db.prepare('SELECT * FROM academy_event_commercial_leads WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId,leadId).first()
  if(!current)return json({error:'Lead não encontrado neste tenant'},404)
  if(String(current.stage)===stage)return json({data:{id:leadId,stage},idempotent:true})
  const now=new Date().toISOString()
  await db.batch([
    db.prepare('UPDATE academy_event_commercial_leads SET stage=?,updated_at=? WHERE tenant_id=? AND id=?').bind(stage,now,auth.tenantId,leadId),
    auditStatement(db,auth,{action:'smart_farm.commercial_lead_stage_changed',resourceType:'event_commercial_lead',resourceId:leadId,metadata:{eventId:current.event_id,interestCode:current.interest_code,previousStage:current.stage,stage}}),
  ])
  return json({data:{id:leadId,stage,updatedAt:now}})
}
