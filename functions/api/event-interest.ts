import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { SMART_FARM_CONSENT } from './_commercial'
import { loadOpportunityCommercialConsentState, userCommercialContactIsSuppressed } from './_commercialConsent'
import { isInterestCode } from './_smartFarm'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireTrustedContext(env,request)
  if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  const eventId=new URL(request.url).searchParams.get('eventId')?.trim()??''
  const rows=await db.prepare(`
    SELECT o.id,o.source_ref AS event_id,o.source_instance_ref AS registration_id,o.interest_code,o.stage,
      o.consent_source,o.consent_recorded_at,o.created_at,o.updated_at,e.title AS event_title
    FROM academy_commercial_opportunities o
    JOIN academy_events e ON e.tenant_id=o.tenant_id AND e.id=o.source_ref
    WHERE o.tenant_id=? AND o.user_id=? AND o.source_type='event' AND (?='' OR o.source_ref=?)
    ORDER BY o.created_at DESC
  `).bind(auth.tenantId,auth.userId,eventId,eventId).all()
  return json({data:(rows.results as any[]).map((row)=>({
    id:row.id,eventId:row.event_id,eventTitle:row.event_title,registrationId:row.registration_id??undefined,
    interestCode:row.interest_code,origin:'smart_farm_experience',stage:row.stage,
    consentSource:row.consent_source,consentRecordedAt:row.consent_recorded_at,createdAt:row.created_at,updatedAt:row.updated_at,
  }))})
}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireTrustedContext(env,request)
  if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  if(await userCommercialContactIsSuppressed(db,auth.tenantId,auth.userId)){
    return json({error:'Contato comercial está bloqueado nas suas preferências. Reative-o antes de registrar novo interesse.'},409)
  }
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

  const existing=await db.prepare(`SELECT * FROM academy_commercial_opportunities
    WHERE tenant_id=? AND user_id=? AND source_type='event' AND source_ref=? AND interest_code=? LIMIT 1`)
    .bind(auth.tenantId,auth.userId,eventId,interestCode).first()
  if(existing){
    const state=await loadOpportunityCommercialConsentState(db,auth.tenantId,auth.userId,String(existing.id))
    if(state.opportunityState==='revoked')return json({error:'Este interesse foi revogado. Reautorize-o nas preferências de privacidade comercial antes de continuar.'},409)
    return json({data:{id:existing.id,eventId,eventTitle:registration.event_title,registrationId:existing.source_instance_ref??registration.id,interestCode,stage:existing.stage,consentSource:existing.consent_source,consentRecordedAt:existing.consent_recorded_at,createdAt:existing.created_at},idempotent:true})
  }

  const id=crypto.randomUUID(),now=new Date().toISOString()
  try{await db.batch([
    db.prepare(`INSERT INTO academy_commercial_opportunities (
      id,tenant_id,user_id,company_id,source_type,source_ref,source_instance_ref,interest_code,
      consent_evidence_type,consent_source,consent_purpose_snapshot,consent_text_snapshot,consent_version,
      consent_recorded_at,stage,created_at,updated_at
    ) VALUES (?,?,?,?,'event',?,?,?,'explicit_event_interest',?,?,?,?,?,'new',?,?)`).bind(
      id,auth.tenantId,auth.userId,registration.company_id??null,eventId,registration.id,interestCode,
      SMART_FARM_CONSENT.source,SMART_FARM_CONSENT.purpose,SMART_FARM_CONSENT.text,SMART_FARM_CONSENT.version,
      now,now,now,
    ),
    auditStatement(db,auth,{action:'smart_farm.commercial_interest_granted',resourceType:'commercial_opportunity',resourceId:id,metadata:{eventId,registrationId:registration.id,interestCode,consentSource:SMART_FARM_CONSENT.source,consentVersion:SMART_FARM_CONSENT.version}}),
  ])}catch{return json({error:'Não foi possível registrar o interesse comercial'},409)}
  return json({data:{id,eventId,eventTitle:registration.event_title,registrationId:registration.id,interestCode,origin:'smart_farm_experience',stage:'new',consentSource:SMART_FARM_CONSENT.source,consentRecordedAt:now,createdAt:now}},201)
}
