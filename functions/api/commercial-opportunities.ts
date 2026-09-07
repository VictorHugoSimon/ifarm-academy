import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { isCommercialOfferSystem, isCommercialSourceType, isCommercialStage, normalizePipelineUpdate } from './_commercial'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES=['academy_admin','ifarm_admin']

function mapOpportunity(row:any){
  return {
    id:String(row.id),userId:String(row.user_id),companyId:row.company_id??null,
    sourceType:String(row.source_type),sourceRef:String(row.source_ref),sourceInstanceRef:row.source_instance_ref??null,
    ruleId:row.rule_id??null,legacyEventLeadId:row.legacy_event_lead_id??null,interestCode:String(row.interest_code),
    offerSystem:row.offer_system??null,offerRef:row.offer_ref??null,offerLabel:row.offer_label_snapshot??null,
    consentEvidenceType:String(row.consent_evidence_type),consentSource:String(row.consent_source),
    consentPurpose:row.consent_purpose_snapshot??null,consentText:row.consent_text_snapshot??null,consentVersion:row.consent_version??null,
    consentRecordedAt:String(row.consent_recorded_at),stage:String(row.stage),assignedToUserId:row.assigned_to_user_id??null,
    conversionRef:row.conversion_ref??null,convertedAt:row.converted_at??null,createdAt:String(row.created_at),updatedAt:String(row.updated_at),
  }
}

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES)
  if(auth instanceof Response)return auth
  const db=dbOr503(env)
  if(db instanceof Response)return db

  const url=new URL(request.url)
  const stage=url.searchParams.get('stage')?.trim()??''
  const sourceType=url.searchParams.get('sourceType')?.trim()??''
  const offerSystem=url.searchParams.get('offerSystem')?.trim()??''
  const interestCode=url.searchParams.get('interestCode')?.trim()??''
  const userId=url.searchParams.get('userId')?.trim()??''
  if(stage&&!isCommercialStage(stage))return json({error:'stage inválido'},400)
  if(sourceType&&!isCommercialSourceType(sourceType))return json({error:'sourceType inválido'},400)
  if(offerSystem&&!isCommercialOfferSystem(offerSystem))return json({error:'offerSystem inválido'},400)
  if(interestCode.length>120||userId.length>180)return json({error:'Filtro inválido'},400)

  const rows=await db.prepare(`SELECT * FROM academy_commercial_opportunities
    WHERE tenant_id=?
      AND (?='' OR stage=?)
      AND (?='' OR source_type=?)
      AND (?='' OR offer_system=?)
      AND (?='' OR interest_code=?)
      AND (?='' OR user_id=?)
    ORDER BY CASE stage WHEN 'new' THEN 0 WHEN 'qualified' THEN 1 WHEN 'contacted' THEN 2 WHEN 'opportunity' THEN 3 WHEN 'converted' THEN 4 ELSE 5 END,
      created_at DESC`).bind(
      auth.tenantId,stage,stage,sourceType,sourceType,offerSystem,offerSystem,interestCode,interestCode,userId,userId,
    ).all()
  return json({data:(rows.results as any[]).map(mapOpportunity)})
}

export const onRequestPut=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES)
  if(auth instanceof Response)return auth
  const db=dbOr503(env)
  if(db instanceof Response)return db
  let body:Record<string,unknown>
  try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}

  const opportunityId=String(body.opportunityId??'').trim()
  if(!opportunityId)return json({error:'opportunityId é obrigatório'},400)
  const current=await db.prepare('SELECT * FROM academy_commercial_opportunities WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId,opportunityId).first()
  if(!current)return json({error:'Oportunidade não encontrada neste tenant'},404)

  const hasStage=body.stage!==undefined
  const pipeline=hasStage?normalizePipelineUpdate({stage:body.stage,conversionRef:body.conversionRef}):null
  if(hasStage&&!pipeline)return json({error:'Etapa comercial ou referência de conversão inválida'},400)
  const nextStage=pipeline?.stage??String(current.stage)
  if(String(current.stage)==='converted'&&nextStage!=='converted')return json({error:'Oportunidade convertida não pode voltar de etapa'},409)

  const assignedTo=body.assignedToUserId===undefined
    ? (current.assigned_to_user_id??null)
    : (String(body.assignedToUserId??'').trim()||null)
  if(assignedTo&&String(assignedTo).length>180)return json({error:'assignedToUserId inválido'},400)

  const now=new Date().toISOString()
  const conversionRef=nextStage==='converted'
    ? (pipeline?.conversionRef??current.conversion_ref??null)
    : (current.conversion_ref??null)
  const convertedAt=nextStage==='converted'?(current.converted_at??now):(current.converted_at??null)

  try{
    await db.batch([
      db.prepare(`UPDATE academy_commercial_opportunities
        SET stage=?,assigned_to_user_id=?,conversion_ref=?,converted_at=?,updated_at=?
        WHERE tenant_id=? AND id=?`).bind(nextStage,assignedTo,conversionRef,convertedAt,now,auth.tenantId,opportunityId),
      auditStatement(db,auth,{action:'commercial_opportunity.pipeline_updated',resourceType:'commercial_opportunity',resourceId:opportunityId,metadata:{previousStage:current.stage,stage:nextStage,previousAssignedTo:current.assigned_to_user_id??null,assignedToUserId:assignedTo,conversionRef:conversionRef??null}}),
    ])
  }catch{return json({error:'Atualização comercial rejeitada pelos invariantes do domínio'},409)}

  const updated=await db.prepare('SELECT * FROM academy_commercial_opportunities WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId,opportunityId).first()
  return json({data:mapOpportunity(updated)})
}
