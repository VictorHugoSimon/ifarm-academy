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
    SELECT o.*,e.title AS event_title,r.display_name_snapshot
    FROM academy_commercial_opportunities o
    JOIN academy_events e ON e.tenant_id=o.tenant_id AND e.id=o.source_ref
    LEFT JOIN academy_event_registrations r ON r.tenant_id=o.tenant_id AND r.id=o.source_instance_ref
    WHERE o.tenant_id=? AND o.source_type='event' AND (?='' OR o.source_ref=?) AND (?='' OR o.stage=?)
      AND o.stage IN ('new','qualified','contacted','converted','discarded')
    ORDER BY o.created_at DESC
  `).bind(auth.tenantId,eventId,eventId,stage,stage).all()
  return json({data:(rows.results as any[]).map((row)=>({
    id:row.id,eventId:row.source_ref,eventTitle:row.event_title,registrationId:row.source_instance_ref??undefined,
    userId:row.user_id,displayName:row.display_name_snapshot??undefined,companyId:row.company_id??null,
    interestCode:row.interest_code,origin:'smart_farm_experience',consentSource:row.consent_source,
    consentRecordedAt:row.consent_recorded_at,stage:row.stage,createdAt:row.created_at,updatedAt:row.updated_at,
    conversionRef:row.conversion_ref??null,
  }))})
}

export const onRequestPut=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin'])
  if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const leadId=String(body.leadId??'').trim(),stage=String(body.stage??'').trim()
  const conversionRef=String(body.conversionRef??'').trim()||null
  if(!leadId||!STAGES.includes(stage))return json({error:'leadId ou stage inválido'},400)
  if(stage==='converted'&&!conversionRef)return json({error:'conversionRef é obrigatório para registrar conversão'},400)
  const current=await db.prepare(`SELECT * FROM academy_commercial_opportunities WHERE tenant_id=? AND id=? AND source_type='event' LIMIT 1`).bind(auth.tenantId,leadId).first()
  if(!current)return json({error:'Lead não encontrado neste tenant'},404)
  if(String(current.stage)==='converted'&&stage!=='converted')return json({error:'Oportunidade convertida não pode ser reaberta'},409)
  if(String(current.stage)===stage&&stage!=='converted')return json({data:{id:leadId,stage},idempotent:true})
  if(String(current.stage)==='converted'&&stage==='converted'&&String(current.conversion_ref??'')===conversionRef)return json({data:{id:leadId,stage,conversionRef},idempotent:true})
  const now=new Date().toISOString()
  const convertedAt=stage==='converted'?now:null
  const statements:any[]=[
    db.prepare(`UPDATE academy_commercial_opportunities SET stage=?,conversion_ref=?,converted_at=?,updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(stage,stage==='converted'?conversionRef:null,convertedAt,now,auth.tenantId,leadId),
    auditStatement(db,auth,{action:'smart_farm.commercial_lead_stage_changed',resourceType:'commercial_opportunity',resourceId:leadId,metadata:{eventId:current.source_ref,interestCode:current.interest_code,previousStage:current.stage,stage,conversionRef:stage==='converted'?conversionRef:undefined}}),
  ]
  if(current.legacy_event_lead_id){
    statements.push(db.prepare('UPDATE academy_event_commercial_leads SET stage=?,updated_at=? WHERE tenant_id=? AND id=?').bind(stage,now,auth.tenantId,current.legacy_event_lead_id))
  }
  try{await db.batch(statements)}catch{return json({error:'Não foi possível atualizar a oportunidade comercial'},409)}
  return json({data:{id:leadId,stage,conversionRef:stage==='converted'?conversionRef:null,updatedAt:now}})
}
