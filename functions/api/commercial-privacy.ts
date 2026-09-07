import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { loadGlobalCommercialContactState, loadOpportunityCommercialConsentState } from './_commercialConsent'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ACTIONS=new Set(['suppress_all','resume','revoke','regrant'])

function reasonText(value:unknown){const reason=String(value??'').trim();return reason.slice(0,500)||null}

function mapOpportunity(row:any,state:any){
  const evidence=String(row.consent_evidence_type)
  const explicitRule=evidence==='explicit_rule_opt_in'&&String(row.rule_status??'')==='active'&&row.rule_consent_version
  const explicitEvent=evidence==='explicit_event_interest'&&row.consent_version
  return {
    id:String(row.id),sourceType:String(row.source_type),sourceRef:String(row.source_ref),interestCode:String(row.interest_code),
    offerLabel:row.offer_label_snapshot??null,offerSystem:row.offer_system??null,offerRef:row.offer_ref??null,
    consentEvidenceType:evidence,consentVersion:row.consent_version??null,consentRecordedAt:String(row.consent_recorded_at),stage:String(row.stage),
    createdAt:String(row.created_at),globalState:state.globalState,opportunityState:state.opportunityState,contactAllowed:state.contactAllowed,
    latestGlobalEvent:state.latestGlobalEvent,latestOpportunityEvent:state.latestOpportunityEvent,
    regrantAvailable:Boolean(explicitRule||explicitEvent),
    regrantConsentVersion:explicitRule?String(row.rule_consent_version):explicitEvent?String(row.consent_version):null,
    regrantConsentPurpose:explicitRule?(row.rule_consent_purpose??null):(row.consent_purpose_snapshot??null),
    regrantConsentText:explicitRule?(row.rule_consent_text??null):(row.consent_text_snapshot??null),
  }
}

async function loadPrivacyView(db:any,tenantId:string,userId:string){
  const global=await loadGlobalCommercialContactState(db,tenantId,userId)
  const result=await db.prepare(`SELECT o.*,r.status AS rule_status,r.consent_version AS rule_consent_version,
      r.consent_purpose AS rule_consent_purpose,r.consent_text AS rule_consent_text
    FROM academy_commercial_opportunities o
    LEFT JOIN academy_commercial_offer_rules r ON r.tenant_id=o.tenant_id AND r.id=o.rule_id
    WHERE o.tenant_id=? AND o.user_id=? ORDER BY o.created_at DESC LIMIT 100`).bind(tenantId,userId).all()
  const opportunities=await Promise.all((result.results as any[]).map(async(row)=>{
    const state=await loadOpportunityCommercialConsentState(db,tenantId,userId,String(row.id))
    return mapOpportunity(row,state)
  }))
  return {globalState:global.globalState,contactAvailable:global.globalState==='available',latestGlobalEvent:global.latestEvent,opportunities}
}

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireTrustedContext(env,request);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  return json({data:await loadPrivacyView(db,auth.tenantId,auth.userId)})
}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireTrustedContext(env,request);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const action=String(body.action??'').trim(),reason=reasonText(body.reason),opportunityId=String(body.opportunityId??'').trim()
  if(!ACTIONS.has(action))return json({error:'action inválida'},400)
  const now=new Date().toISOString()

  if(action==='suppress_all'||action==='resume'){
    const current=await loadGlobalCommercialContactState(db,auth.tenantId,auth.userId)
    const desired=action==='suppress_all'?'suppressed':'available'
    if(current.globalState===desired)return json({data:await loadPrivacyView(db,auth.tenantId,auth.userId),idempotent:true})
    const id=crypto.randomUUID()
    const statements=[
      db.prepare(`INSERT INTO academy_commercial_contact_preference_events
        (id,tenant_id,user_id,action,source,reason,recorded_by,created_at) VALUES (?,?,?,?, 'self_service',?,?,?)`)
        .bind(id,auth.tenantId,auth.userId,action,reason,auth.userId,now),
      auditStatement(db,auth,{action:`commercial_privacy.${action}`,resourceType:'commercial_contact_preference',resourceId:id,metadata:{reason}}),
    ]
    if(action==='suppress_all')statements.splice(1,0,
      db.prepare(`UPDATE academy_commercial_handoff_outbox SET status='cancelled',next_attempt_at=NULL,updated_at=?
        WHERE tenant_id=? AND status IN ('pending','processing','failed') AND opportunity_id IN (
          SELECT id FROM academy_commercial_opportunities WHERE tenant_id=? AND user_id=?
        )`).bind(now,auth.tenantId,auth.tenantId,auth.userId),
    )
    try{await db.batch(statements)}catch{return json({error:'Não foi possível atualizar a preferência comercial'},409)}
    return json({data:await loadPrivacyView(db,auth.tenantId,auth.userId)})
  }

  if(!opportunityId)return json({error:'opportunityId é obrigatório'},400)
  const opportunity=await db.prepare(`SELECT * FROM academy_commercial_opportunities WHERE tenant_id=? AND user_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId,auth.userId,opportunityId).first()
  if(!opportunity)return json({error:'Oportunidade comercial não encontrada para este usuário'},404)
  const state=await loadOpportunityCommercialConsentState(db,auth.tenantId,auth.userId,opportunityId)

  if(action==='revoke'){
    if(state.opportunityState==='revoked')return json({data:await loadPrivacyView(db,auth.tenantId,auth.userId),idempotent:true})
    const id=crypto.randomUUID()
    try{await db.batch([
      db.prepare(`INSERT INTO academy_commercial_opportunity_consent_events
        (id,tenant_id,opportunity_id,user_id,action,source,reason,recorded_by,created_at)
        VALUES (?,?,?,?, 'revoked','self_service',?,?,?)`).bind(id,auth.tenantId,opportunityId,auth.userId,reason,auth.userId,now),
      db.prepare(`UPDATE academy_commercial_handoff_outbox SET status='cancelled',next_attempt_at=NULL,updated_at=?
        WHERE tenant_id=? AND opportunity_id=? AND status IN ('pending','processing','failed')`).bind(now,auth.tenantId,opportunityId),
      auditStatement(db,auth,{action:'commercial_privacy.revoked',resourceType:'commercial_opportunity',resourceId:opportunityId,metadata:{reason}}),
    ])}catch{return json({error:'Não foi possível revogar o consentimento desta oportunidade'},409)}
    return json({data:await loadPrivacyView(db,auth.tenantId,auth.userId)})
  }

  if(state.globalState==='suppressed')return json({error:'Reative primeiro a preferência global de contato comercial'},409)
  if(state.opportunityState==='granted')return json({data:await loadPrivacyView(db,auth.tenantId,auth.userId),idempotent:true})
  const consentVersion=String(body.consentVersion??'').trim()
  if(!consentVersion)return json({error:'consentVersion é obrigatória para reautorizar'},400)
  const id=crypto.randomUUID()
  try{await db.batch([
    db.prepare(`INSERT INTO academy_commercial_opportunity_consent_events
      (id,tenant_id,opportunity_id,user_id,action,source,consent_version,reason,recorded_by,created_at)
      VALUES (?,?,?,?, 'regranted','self_service',?,?,?,?)`).bind(id,auth.tenantId,opportunityId,auth.userId,consentVersion,reason,auth.userId,now),
    auditStatement(db,auth,{action:'commercial_privacy.regranted',resourceType:'commercial_opportunity',resourceId:opportunityId,metadata:{consentVersion,reason}}),
  ])}catch{return json({error:'A reautorização exige consentimento explícito verificável e versão vigente'},409)}
  return json({data:await loadPrivacyView(db,auth.tenantId,auth.userId)})
}
