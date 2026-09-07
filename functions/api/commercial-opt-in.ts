import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { verifyCommercialSourceEligibility } from './_commercial'
import { bodyJson, dbOr503, json, type Env } from './_shared'

function mapOpportunity(row:any){
  return {
    id:String(row.id),sourceType:String(row.source_type),sourceRef:String(row.source_ref),sourceInstanceRef:row.source_instance_ref??null,
    interestCode:String(row.interest_code),offerSystem:row.offer_system??null,offerRef:row.offer_ref??null,
    offerLabel:row.offer_label_snapshot??null,consentSource:String(row.consent_source),consentVersion:row.consent_version??null,
    consentRecordedAt:String(row.consent_recorded_at),stage:String(row.stage),createdAt:String(row.created_at),updatedAt:String(row.updated_at),
  }
}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireTrustedContext(env,request)
  if(auth instanceof Response)return auth
  const db=dbOr503(env)
  if(db instanceof Response)return db

  let body:Record<string,unknown>
  try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const ruleId=String(body.ruleId??'').trim()
  const consent=body.consent===true
  const consentVersion=String(body.consentVersion??'').trim()
  if(!ruleId||!consent)return json({error:'Consentimento explícito e ruleId são obrigatórios'},400)

  const rule=await db.prepare(`SELECT * FROM academy_commercial_offer_rules WHERE tenant_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId,ruleId).first()
  if(!rule)return json({error:'Oferta comercial não encontrada neste tenant'},404)
  if(String(rule.status)!=='active')return json({error:'Oferta comercial não está ativa'},409)
  if(!consentVersion||consentVersion!==String(rule.consent_version))return json({error:'A versão de consentimento mudou. Recarregue a recomendação antes de confirmar.'},409)

  const now=new Date().toISOString()
  if(rule.active_from&&Date.parse(String(rule.active_from))>Date.parse(now))return json({error:'Oferta ainda não está vigente'},409)
  if(rule.active_until&&Date.parse(String(rule.active_until))<=Date.parse(now))return json({error:'Oferta não está mais vigente'},409)

  const sourceType=String(rule.source_type) as any
  const sourceRef=String(rule.source_ref)
  const eligibility=await verifyCommercialSourceEligibility(db,auth.tenantId,auth.userId,sourceType,sourceRef)
  if(!eligibility.eligible)return json({error:eligibility.reason},409)

  const existing=await db.prepare(`SELECT * FROM academy_commercial_opportunities
    WHERE tenant_id=? AND user_id=? AND source_type=? AND source_ref=? AND rule_id=? LIMIT 1`)
    .bind(auth.tenantId,auth.userId,sourceType,sourceRef,ruleId).first()
  if(existing)return json({data:mapOpportunity(existing),idempotent:true})

  const id=crypto.randomUUID()
  try{
    await db.batch([
      db.prepare(`INSERT INTO academy_commercial_opportunities (
        id,tenant_id,user_id,company_id,source_type,source_ref,source_instance_ref,rule_id,
        interest_code,offer_system,offer_ref,offer_label_snapshot,consent_evidence_type,consent_source,
        consent_purpose_snapshot,consent_text_snapshot,consent_version,consent_recorded_at,stage,
        created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'explicit_rule_opt_in','academy_offer_rule',?,?,?,?, 'new',?,?)`).bind(
        id,auth.tenantId,auth.userId,eligibility.companyId,sourceType,sourceRef,eligibility.sourceInstanceRef,ruleId,
        rule.interest_code,rule.offer_system,rule.offer_ref,rule.offer_label,
        rule.consent_purpose,rule.consent_text,rule.consent_version,now,now,now,
      ),
      auditStatement(db,auth,{action:'commercial_opportunity.opt_in_granted',resourceType:'commercial_opportunity',resourceId:id,metadata:{ruleId,sourceType,sourceRef,interestCode:rule.interest_code,offerSystem:rule.offer_system,offerRef:rule.offer_ref,consentVersion:rule.consent_version}}),
    ])
  }catch{
    const duplicate=await db.prepare(`SELECT * FROM academy_commercial_opportunities
      WHERE tenant_id=? AND user_id=? AND source_type=? AND source_ref=? AND rule_id=? LIMIT 1`)
      .bind(auth.tenantId,auth.userId,sourceType,sourceRef,ruleId).first()
    if(duplicate)return json({data:mapOpportunity(duplicate),idempotent:true})
    return json({error:'Não foi possível registrar a oportunidade comercial'},409)
  }

  const created=await db.prepare('SELECT * FROM academy_commercial_opportunities WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId,id).first()
  return json({data:mapOpportunity(created)},201)
}
