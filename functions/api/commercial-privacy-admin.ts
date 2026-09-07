import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { loadGlobalCommercialContactState, loadOpportunityCommercialConsentState } from './_commercialConsent'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES=['academy_admin','ifarm_admin']
const ACTIONS=new Set(['suppress_all','resume','revoke','regrant'])

function reasonText(value:unknown){const reason=String(value??'').trim();return reason.slice(0,500)||null}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const targetUserId=String(body.targetUserId??'').trim(),action=String(body.action??'').trim(),opportunityId=String(body.opportunityId??'').trim(),reason=reasonText(body.reason)
  if(!targetUserId||!ACTIONS.has(action))return json({error:'targetUserId ou action inválido'},400)
  if(!reason)return json({error:'reason é obrigatório para solicitação administrativa de privacidade'},400)
  const now=new Date().toISOString()

  if(action==='suppress_all'||action==='resume'){
    const current=await loadGlobalCommercialContactState(db,auth.tenantId,targetUserId)
    const desired=action==='suppress_all'?'suppressed':'available'
    if(current.globalState===desired)return json({data:{targetUserId,globalState:current.globalState},idempotent:true})
    const id=crypto.randomUUID(),statements=[
      db.prepare(`INSERT INTO academy_commercial_contact_preference_events
        (id,tenant_id,user_id,action,source,reason,recorded_by,created_at) VALUES (?,?,?,?, 'admin_privacy_request',?,?,?)`)
        .bind(id,auth.tenantId,targetUserId,action,reason,auth.userId,now),
      auditStatement(db,auth,{action:`commercial_privacy_admin.${action}`,resourceType:'commercial_contact_preference',resourceId:id,metadata:{targetUserId,reason}}),
    ]
    if(action==='suppress_all')statements.splice(1,0,
      db.prepare(`UPDATE academy_commercial_handoff_outbox SET status='cancelled',next_attempt_at=NULL,updated_at=?
        WHERE tenant_id=? AND status IN ('pending','processing','failed') AND opportunity_id IN (
          SELECT id FROM academy_commercial_opportunities WHERE tenant_id=? AND user_id=?
        )`).bind(now,auth.tenantId,auth.tenantId,targetUserId),
    )
    try{await db.batch(statements)}catch{return json({error:'Não foi possível processar a solicitação administrativa'},409)}
    const updated=await loadGlobalCommercialContactState(db,auth.tenantId,targetUserId)
    return json({data:{targetUserId,globalState:updated.globalState,latestEvent:updated.latestEvent}})
  }

  if(!opportunityId)return json({error:'opportunityId é obrigatório'},400)
  const opportunity=await db.prepare(`SELECT * FROM academy_commercial_opportunities WHERE tenant_id=? AND user_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId,targetUserId,opportunityId).first()
  if(!opportunity)return json({error:'Oportunidade não encontrada para o usuário neste tenant'},404)
  const state=await loadOpportunityCommercialConsentState(db,auth.tenantId,targetUserId,opportunityId)

  if(action==='revoke'){
    if(state.opportunityState==='revoked')return json({data:{targetUserId,opportunityId,opportunityState:'revoked'},idempotent:true})
    const id=crypto.randomUUID()
    try{await db.batch([
      db.prepare(`INSERT INTO academy_commercial_opportunity_consent_events
        (id,tenant_id,opportunity_id,user_id,action,source,reason,recorded_by,created_at)
        VALUES (?,?,?,?, 'revoked','admin_privacy_request',?,?,?)`).bind(id,auth.tenantId,opportunityId,targetUserId,reason,auth.userId,now),
      db.prepare(`UPDATE academy_commercial_handoff_outbox SET status='cancelled',next_attempt_at=NULL,updated_at=?
        WHERE tenant_id=? AND opportunity_id=? AND status IN ('pending','processing','failed')`).bind(now,auth.tenantId,opportunityId),
      auditStatement(db,auth,{action:'commercial_privacy_admin.revoked',resourceType:'commercial_opportunity',resourceId:opportunityId,metadata:{targetUserId,reason}}),
    ])}catch{return json({error:'Não foi possível revogar o consentimento'},409)}
    return json({data:{targetUserId,opportunityId,opportunityState:'revoked'}})
  }

  if(state.globalState==='suppressed')return json({error:'O usuário possui bloqueio global de contato comercial'},409)
  if(state.opportunityState==='granted')return json({data:{targetUserId,opportunityId,opportunityState:'granted'},idempotent:true})
  const consentVersion=String(body.consentVersion??'').trim()
  if(!consentVersion)return json({error:'consentVersion é obrigatória para reautorizar'},400)
  const id=crypto.randomUUID()
  try{await db.batch([
    db.prepare(`INSERT INTO academy_commercial_opportunity_consent_events
      (id,tenant_id,opportunity_id,user_id,action,source,consent_version,reason,recorded_by,created_at)
      VALUES (?,?,?,?, 'regranted','admin_privacy_request',?,?,?,?)`).bind(id,auth.tenantId,opportunityId,targetUserId,consentVersion,reason,auth.userId,now),
    auditStatement(db,auth,{action:'commercial_privacy_admin.regranted',resourceType:'commercial_opportunity',resourceId:opportunityId,metadata:{targetUserId,consentVersion,reason}}),
  ])}catch{return json({error:'Reautorização rejeitada: valide regra ativa e versão atual do consentimento'},409)}
  return json({data:{targetUserId,opportunityId,opportunityState:'granted'}})
}
