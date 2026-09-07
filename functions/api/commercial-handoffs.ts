import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { opportunityCommercialContactIsAllowed } from './_commercialConsent'
import { buildCommercialHandoffPayload,isCommercialHandoffDestination } from './_commercialHandoff'
import { bodyJson,dbOr503,json,type Env } from './_shared'

const ADMIN_ROLES=['academy_admin','ifarm_admin']
const STATUSES=new Set(['pending','processing','delivered','failed','cancelled'])

function mapHandoff(row:any){return{
  id:String(row.id),opportunityId:String(row.opportunity_id),destinationSystem:String(row.destination_system),eventType:String(row.event_type),
  payloadVersion:Number(row.payload_version),status:String(row.status),attempts:Number(row.attempts),nextAttemptAt:row.next_attempt_at??null,
  deliveryReference:row.delivery_reference??null,lastErrorCode:row.last_error_code??null,requestedBy:String(row.requested_by),
  createdAt:String(row.created_at),updatedAt:String(row.updated_at),deliveredAt:row.delivered_at??null,
}}

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  const url=new URL(request.url),status=url.searchParams.get('status')?.trim()??'',destination=url.searchParams.get('destinationSystem')?.trim()??''
  if(status&&!STATUSES.has(status))return json({error:'status inválido'},400)
  if(destination&&!isCommercialHandoffDestination(destination))return json({error:'destinationSystem inválido'},400)
  const rows=await db.prepare(`SELECT * FROM academy_commercial_handoff_outbox
    WHERE tenant_id=? AND (?='' OR status=?) AND (?='' OR destination_system=?) ORDER BY created_at DESC`)
    .bind(auth.tenantId,status,status,destination,destination).all()
  return json({data:(rows.results as any[]).map(mapHandoff)})
}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const opportunityId=String(body.opportunityId??'').trim(),destinationSystem=String(body.destinationSystem??'ifarm_core').trim()
  if(!opportunityId||!isCommercialHandoffDestination(destinationSystem))return json({error:'opportunityId ou destinationSystem inválido'},400)
  const opportunity=await db.prepare('SELECT * FROM academy_commercial_opportunities WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId,opportunityId).first()
  if(!opportunity)return json({error:'Oportunidade não encontrada neste tenant'},404)
  if(!['qualified','contacted','opportunity','converted'].includes(String(opportunity.stage)))return json({error:'Qualifique a oportunidade antes de preparar o handoff'},409)
  if(!await opportunityCommercialContactIsAllowed(db,auth.tenantId,String(opportunity.user_id),opportunityId)){
    return json({error:'Handoff bloqueado pela preferência de privacidade/consentimento do usuário'},409)
  }

  const existing=await db.prepare(`SELECT * FROM academy_commercial_handoff_outbox WHERE tenant_id=? AND opportunity_id=? AND destination_system=? AND event_type='commercial.opportunity.ready' AND status IN ('pending','processing','failed') LIMIT 1`)
    .bind(auth.tenantId,opportunityId,destinationSystem).first()
  if(existing)return json({data:mapHandoff(existing),idempotent:true})

  const id=crypto.randomUUID(),now=new Date().toISOString(),payload=buildCommercialHandoffPayload(opportunity)
  try{await db.batch([
    db.prepare(`INSERT INTO academy_commercial_handoff_outbox (
      id,tenant_id,opportunity_id,destination_system,event_type,payload_version,payload_json,status,attempts,requested_by,created_at,updated_at
    ) VALUES (?,?,?,?,'commercial.opportunity.ready',1,?,'pending',0,?,?,?)`)
      .bind(id,auth.tenantId,opportunityId,destinationSystem,JSON.stringify(payload),auth.userId,now,now),
    auditStatement(db,auth,{action:'commercial_handoff.requested',resourceType:'commercial_handoff',resourceId:id,metadata:{opportunityId,destinationSystem,eventType:'commercial.opportunity.ready',payloadVersion:1}}),
  ])}catch{return json({error:'Não foi possível preparar o handoff'},409)}
  const created=await db.prepare('SELECT * FROM academy_commercial_handoff_outbox WHERE tenant_id=? AND id=?').bind(auth.tenantId,id).first()
  return json({data:mapHandoff(created)},201)
}

export const onRequestPut=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const handoffId=String(body.handoffId??'').trim(),action=String(body.action??'').trim()
  if(!handoffId||!['processing','delivered','failed','retry','cancel'].includes(action))return json({error:'handoffId ou action inválido'},400)
  const current=await db.prepare('SELECT * FROM academy_commercial_handoff_outbox WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId,handoffId).first()
  if(!current)return json({error:'Handoff não encontrado neste tenant'},404)
  if(['delivered','cancelled'].includes(String(current.status)))return json({error:'Handoff já está em estado terminal'},409)

  if(['processing','delivered','retry'].includes(action)){
    const opportunity=await db.prepare('SELECT user_id FROM academy_commercial_opportunities WHERE tenant_id=? AND id=? LIMIT 1')
      .bind(auth.tenantId,current.opportunity_id).first()
    if(!opportunity||!await opportunityCommercialContactIsAllowed(db,auth.tenantId,String(opportunity.user_id),String(current.opportunity_id))){
      return json({error:'Transição bloqueada pela preferência de privacidade/consentimento do usuário'},409)
    }
  }

  const now=new Date().toISOString()
  let status=String(current.status),attempts=Number(current.attempts),deliveryReference=current.delivery_reference??null,lastErrorCode=current.last_error_code??null,deliveredAt=current.delivered_at??null,nextAttemptAt=current.next_attempt_at??null
  if(action==='processing'){status='processing';attempts+=1;nextAttemptAt=null}
  if(action==='delivered'){
    deliveryReference=String(body.deliveryReference??'').trim()||null
    if(!deliveryReference)return json({error:'deliveryReference é obrigatória'},400)
    status='delivered';deliveredAt=now;lastErrorCode=null;nextAttemptAt=null
  }
  if(action==='failed'){
    lastErrorCode=String(body.errorCode??'').trim()||null
    if(!lastErrorCode)return json({error:'errorCode é obrigatório'},400)
    status='failed';nextAttemptAt=String(body.nextAttemptAt??'').trim()||null
  }
  if(action==='retry'){if(String(current.status)!=='failed')return json({error:'Somente handoff failed pode voltar para pending'},409);status='pending';lastErrorCode=null;nextAttemptAt=null}
  if(action==='cancel'){status='cancelled';nextAttemptAt=null}

  try{await db.batch([
    db.prepare(`UPDATE academy_commercial_handoff_outbox SET status=?,attempts=?,next_attempt_at=?,delivery_reference=?,last_error_code=?,delivered_at=?,updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(status,attempts,nextAttemptAt,deliveryReference,lastErrorCode,deliveredAt,now,auth.tenantId,handoffId),
    auditStatement(db,auth,{action:`commercial_handoff.${action}`,resourceType:'commercial_handoff',resourceId:handoffId,metadata:{opportunityId:current.opportunity_id,destinationSystem:current.destination_system,status,attempts,deliveryReference,lastErrorCode}}),
  ])}catch{return json({error:'Transição de handoff rejeitada'},409)}
  const updated=await db.prepare('SELECT * FROM academy_commercial_handoff_outbox WHERE tenant_id=? AND id=?').bind(auth.tenantId,handoffId).first()
  return json({data:mapHandoff(updated)})
}
