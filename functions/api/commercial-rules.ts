import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { commercialConsentSnapshot, commercialToken, isCommercialOfferSystem, isCommercialSourceType } from './_commercial'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES=['academy_admin','ifarm_admin']
const STATUSES=new Set(['draft','active','archived'])

function text(value:unknown,max:number,required=false):string|null{
  const normalized=String(value??'').trim()
  if(!normalized)return required?null:''
  if(normalized.length>max)return null
  return normalized
}

async function sourceExists(db:any,tenantId:string,sourceType:string,sourceRef:string){
  if(sourceType==='course_completion'||sourceType==='certificate_issued')return Boolean(await db.prepare('SELECT id FROM academy_courses WHERE tenant_id=? AND id=? LIMIT 1').bind(tenantId,sourceRef).first())
  if(sourceType==='event')return Boolean(await db.prepare('SELECT id FROM academy_events WHERE tenant_id=? AND id=? LIMIT 1').bind(tenantId,sourceRef).first())
  if(sourceType==='learning_path')return Boolean(await db.prepare('SELECT id FROM academy_public_learning_paths WHERE tenant_id=? AND id=? LIMIT 1').bind(tenantId,sourceRef).first())
  return Boolean(await db.prepare('SELECT id FROM academy_plans WHERE tenant_id=? AND id=? LIMIT 1').bind(tenantId,sourceRef).first())
}

function mapRule(row:any){return{
  id:row.id,sourceType:row.source_type,sourceRef:row.source_ref,interestCode:row.interest_code,
  offerSystem:row.offer_system,offerRef:row.offer_ref,offerLabel:row.offer_label,offerDescription:row.offer_description??'',ctaLabel:row.cta_label,
  consentPurpose:row.consent_purpose,consentText:row.consent_text,consentVersion:row.consent_version,
  priority:Number(row.priority),status:row.status,activeFrom:row.active_from??null,activeUntil:row.active_until??null,
  createdBy:row.created_by,createdAt:row.created_at,updatedAt:row.updated_at,
}}

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  const url=new URL(request.url),sourceType=url.searchParams.get('sourceType')?.trim()??'',status=url.searchParams.get('status')?.trim()??''
  if(sourceType&&!isCommercialSourceType(sourceType))return json({error:'sourceType inválido'},400)
  if(status&&!STATUSES.has(status))return json({error:'status inválido'},400)
  const result=await db.prepare(`SELECT * FROM academy_commercial_offer_rules
    WHERE tenant_id=? AND (?='' OR source_type=?) AND (?='' OR status=?)
    ORDER BY status='archived',source_type,source_ref,priority,created_at DESC`).bind(auth.tenantId,sourceType,sourceType,status,status).all()
  return json({data:(result.results as any[]).map(mapRule)})
}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const sourceType=String(body.sourceType??'').trim(),sourceRef=String(body.sourceRef??'').trim()
  const interestCode=commercialToken(body.interestCode)
  const offerSystem=String(body.offerSystem??'').trim(),offerRef=String(body.offerRef??'').trim()
  const offerLabel=text(body.offerLabel,180,true),offerDescription=text(body.offerDescription,800)??'',ctaLabel=text(body.ctaLabel??'Tenho interesse',120,true)
  const consent=commercialConsentSnapshot({purpose:body.consentPurpose,text:body.consentText,version:body.consentVersion})
  const priority=body.priority==null?100:Number(body.priority),status=String(body.status??'draft').trim()
  const activeFrom=String(body.activeFrom??'').trim()||null,activeUntil=String(body.activeUntil??'').trim()||null
  if(!isCommercialSourceType(sourceType)||!sourceRef||sourceRef.length>180)return json({error:'Origem comercial inválida'},400)
  if(!interestCode||!isCommercialOfferSystem(offerSystem)||!offerRef||offerRef.length>240||!offerLabel||!ctaLabel)return json({error:'Oferta comercial inválida'},400)
  if(!consent)return json({error:'Finalidade, texto e versão do consentimento são obrigatórios'},400)
  if(!Number.isInteger(priority)||priority<0||priority>100000)return json({error:'priority inválida'},400)
  if(!STATUSES.has(status))return json({error:'status inválido'},400)
  if(activeFrom&&Number.isNaN(Date.parse(activeFrom)))return json({error:'activeFrom inválido'},400)
  if(activeUntil&&Number.isNaN(Date.parse(activeUntil)))return json({error:'activeUntil inválido'},400)
  if(activeFrom&&activeUntil&&Date.parse(activeUntil)<=Date.parse(activeFrom))return json({error:'Janela de ativação inválida'},400)
  if(!await sourceExists(db,auth.tenantId,sourceType,sourceRef))return json({error:'Origem não encontrada neste tenant'},404)

  const id=crypto.randomUUID(),now=new Date().toISOString()
  try{await db.batch([
    db.prepare(`INSERT INTO academy_commercial_offer_rules (
      id,tenant_id,source_type,source_ref,interest_code,offer_system,offer_ref,offer_label,offer_description,cta_label,
      consent_purpose,consent_text,consent_version,priority,status,active_from,active_until,created_by,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id,auth.tenantId,sourceType,sourceRef,interestCode,offerSystem,offerRef,offerLabel,offerDescription,ctaLabel,
      consent.purpose,consent.text,consent.version,priority,status,activeFrom,activeUntil,auth.userId,now,now,
    ),
    auditStatement(db,auth,{action:'commercial_rule.created',resourceType:'commercial_offer_rule',resourceId:id,metadata:{sourceType,sourceRef,interestCode,offerSystem,offerRef,consentVersion:consent.version,status}}),
  ])}catch{return json({error:'Regra duplicada, conflito de versão ativa ou configuração inválida'},409)}
  return json({data:{id,sourceType,sourceRef,interestCode,offerSystem,offerRef,offerLabel,offerDescription,ctaLabel,...{consentPurpose:consent.purpose,consentText:consent.text,consentVersion:consent.version},priority,status,activeFrom,activeUntil,createdAt:now}},201)
}

export const onRequestPut=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const ruleId=String(body.ruleId??'').trim();if(!ruleId)return json({error:'ruleId é obrigatório'},400)
  const current=await db.prepare('SELECT * FROM academy_commercial_offer_rules WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId,ruleId).first()
  if(!current)return json({error:'Regra não encontrada neste tenant'},404)
  const targetStatus=String(body.status??current.status).trim();if(!STATUSES.has(targetStatus))return json({error:'status inválido'},400)
  if(String(current.status)==='archived'&&targetStatus!=='archived')return json({error:'Regra arquivada não pode ser reativada'},409)
  if(String(current.status)==='active'){
    if(targetStatus==='active')return json({data:mapRule(current),idempotent:true})
    if(targetStatus!=='archived')return json({error:'Regra ativa só pode ser arquivada; para alterar oferta/consentimento crie nova versão'},409)
    const now=new Date().toISOString()
    await db.batch([
      db.prepare("UPDATE academy_commercial_offer_rules SET status='archived',updated_at=? WHERE tenant_id=? AND id=?").bind(now,auth.tenantId,ruleId),
      auditStatement(db,auth,{action:'commercial_rule.archived',resourceType:'commercial_offer_rule',resourceId:ruleId,metadata:{sourceType:current.source_type,sourceRef:current.source_ref,offerSystem:current.offer_system,offerRef:current.offer_ref}}),
    ])
    return json({data:{...mapRule(current),status:'archived',updatedAt:now}})
  }

  const interestCode=commercialToken(body.interestCode??current.interest_code)
  const offerSystem=String(body.offerSystem??current.offer_system).trim(),offerRef=String(body.offerRef??current.offer_ref).trim()
  const offerLabel=text(body.offerLabel??current.offer_label,180,true),offerDescription=text(body.offerDescription??current.offer_description,800)??'',ctaLabel=text(body.ctaLabel??current.cta_label,120,true)
  const consent=commercialConsentSnapshot({purpose:body.consentPurpose??current.consent_purpose,text:body.consentText??current.consent_text,version:body.consentVersion??current.consent_version})
  const priority=body.priority==null?Number(current.priority):Number(body.priority)
  const activeFrom=body.activeFrom===undefined?(current.active_from??null):(String(body.activeFrom??'').trim()||null)
  const activeUntil=body.activeUntil===undefined?(current.active_until??null):(String(body.activeUntil??'').trim()||null)
  if(!interestCode||!isCommercialOfferSystem(offerSystem)||!offerRef||offerRef.length>240||!offerLabel||!ctaLabel||!consent)return json({error:'Configuração comercial inválida'},400)
  if(!Number.isInteger(priority)||priority<0||priority>100000)return json({error:'priority inválida'},400)
  if(activeFrom&&activeUntil&&Date.parse(String(activeUntil))<=Date.parse(String(activeFrom)))return json({error:'Janela de ativação inválida'},400)
  const now=new Date().toISOString()
  try{await db.batch([
    db.prepare(`UPDATE academy_commercial_offer_rules SET interest_code=?,offer_system=?,offer_ref=?,offer_label=?,offer_description=?,cta_label=?,consent_purpose=?,consent_text=?,consent_version=?,priority=?,status=?,active_from=?,active_until=?,updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(interestCode,offerSystem,offerRef,offerLabel,offerDescription,ctaLabel,consent.purpose,consent.text,consent.version,priority,targetStatus,activeFrom,activeUntil,now,auth.tenantId,ruleId),
    auditStatement(db,auth,{action:targetStatus==='active'?'commercial_rule.activated':'commercial_rule.updated',resourceType:'commercial_offer_rule',resourceId:ruleId,metadata:{sourceType:current.source_type,sourceRef:current.source_ref,interestCode,offerSystem,offerRef,consentVersion:consent.version,status:targetStatus}}),
  ])}catch{return json({error:'Conflito com outra regra ativa/versão ou configuração inválida'},409)}
  const updated=await db.prepare('SELECT * FROM academy_commercial_offer_rules WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId,ruleId).first()
  return json({data:mapRule(updated)})
}
