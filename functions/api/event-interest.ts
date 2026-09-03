import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { isInterestCode } from './_smartFarm'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireTrustedContext(env,request)
  if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  const eventId=new URL(request.url).searchParams.get('eventId')?.trim()??''
  const rows=await db.prepare(`
    SELECT l.id,l.event_id,l.interest_code,l.stage,l.consent_source,l.consent_recorded_at,l.created_at,e.title AS event_title
    FROM academy_event_commercial_leads l
    JOIN academy_events e ON e.tenant_id=l.tenant_id AND e.id=l.event_id
    WHERE l.tenant_id=? AND l.user_id=? AND (?='' OR l.event_id=?)
    ORDER BY l.created_at DESC
  `).bind(auth.tenantId,auth.userId,eventId,eventId).all()
  return json({data:(rows.results as any[]).map((row)=>({
    id:row.id,eventId:row.event_id,eventTitle:row.event_title,interestCode:row.interest_code,
    stage:row.stage,consentSource:row.consent_source,consentRecordedAt:row.consent_recorded_at,createdAt:row.created_at,
  }))})
}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireTrustedContext(env,request)
  if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const eventId=String(body.eventId??'').trim()
  const interestCode=String(body.interestCode??'').trim()
  const consent=body.consent===true
  if(!eventId||!isInterestCode(interestCode))return json({error:'eventId ou interestCode inválido'},400)
  if(!consent)return json({error:'Consentimento explícito é obrigatório para gerar oportunidade comercial'},400)

  const registration=await db.prepare(`
    SELECT r.*,e.title AS event_title,e.status AS event_status,e.smart_farm_experience
    FROM academy_event_registrations r
    JOIN academy_events e ON e.tenant_id=r.tenant_id AND e.id=r.event_id
    WHERE r.tenant_id=? AND r.event_id=? AND r.user_id=? LIMIT 1
  `).bind(auth.tenantId,eventId,auth.userId).first()
  if(!registration||Number(registration.smart_farm_experience)!==1)return json({error:'Inscrição Smart Farm Experience não encontrada'},404)
  if(!['registered','attended'].includes(String(registration.status)))return json({error:'Inscrição não está habilitada para registrar interesse'},409)
  if(String(registration.event_status)==='cancelled')return json({error:'Evento cancelado'},409)

  const existing=await db.prepare(`SELECT * FROM academy_event_commercial_leads WHERE tenant_id=? AND event_id=? AND registration_id=? AND interest_code=? LIMIT 1`)
    .bind(auth.tenantId,eventId,registration.id,interestCode).first()
  if(existing)return json({data:{id:existing.id,eventId,interestCode,stage:existing.stage,consentRecordedAt:existing.consent_recorded_at},idempotent:true})

  const id=crypto.randomUUID(),now=new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO academy_event_commercial_leads (
      id,tenant_id,event_id,registration_id,user_id,company_id,interest_code,origin,
      consent_source,consent_recorded_at,stage,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,'smart_farm_experience','explicit_event_interest',?,'new',?,?)`).bind(
      id,auth.tenantId,eventId,registration.id,auth.userId,registration.company_id??null,interestCode,now,now,now,
    ),
    auditStatement(db,auth,{action:'smart_farm.commercial_interest_granted',resourceType:'event_commercial_lead',resourceId:id,metadata:{eventId,registrationId:registration.id,interestCode,consentSource:'explicit_event_interest'}}),
  ])
  return json({data:{id,eventId,eventTitle:registration.event_title,interestCode,stage:'new',consentRecordedAt:now}},201)
}
