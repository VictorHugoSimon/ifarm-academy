import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { isCommercialEvidenceSystem,normalizeAttributedValue,normalizeCurrency } from './_commercialHandoff'
import { bodyJson,dbOr503,json,type Env } from './_shared'

const ADMIN_ROLES=['academy_admin','ifarm_admin']

function mapEvidence(row:any){return{
  id:String(row.id),opportunityId:String(row.opportunity_id),evidenceSystem:String(row.evidence_system),evidenceRef:String(row.evidence_ref),
  attributedValueCents:row.attributed_value_cents==null?null:Number(row.attributed_value_cents),currency:String(row.currency),
  confirmedAt:String(row.confirmed_at),recordedBy:String(row.recorded_by),createdAt:String(row.created_at),
}}

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  const url=new URL(request.url),opportunityId=url.searchParams.get('opportunityId')?.trim()??'',evidenceSystem=url.searchParams.get('evidenceSystem')?.trim()??''
  if(evidenceSystem&&!isCommercialEvidenceSystem(evidenceSystem))return json({error:'evidenceSystem inválido'},400)
  const rows=await db.prepare(`SELECT * FROM academy_commercial_conversion_evidence
    WHERE tenant_id=? AND (?='' OR opportunity_id=?) AND (?='' OR evidence_system=?) ORDER BY confirmed_at DESC`)
    .bind(auth.tenantId,opportunityId,opportunityId,evidenceSystem,evidenceSystem).all()
  return json({data:(rows.results as any[]).map(mapEvidence)})
}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,ADMIN_ROLES);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const opportunityId=String(body.opportunityId??'').trim(),evidenceSystem=String(body.evidenceSystem??'').trim(),evidenceRef=String(body.evidenceRef??'').trim()
  const attributedValueCents=normalizeAttributedValue(body.attributedValueCents),currency=normalizeCurrency(body.currency)
  const confirmedAt=String(body.confirmedAt??new Date().toISOString()).trim()
  if(!opportunityId||!isCommercialEvidenceSystem(evidenceSystem)||!evidenceRef||evidenceRef.length>240)return json({error:'Evidência comercial inválida'},400)
  if(attributedValueCents===undefined||!currency||Number.isNaN(Date.parse(confirmedAt)))return json({error:'Valor, moeda ou data inválida'},400)
  const opportunity=await db.prepare('SELECT * FROM academy_commercial_opportunities WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId,opportunityId).first()
  if(!opportunity)return json({error:'Oportunidade não encontrada neste tenant'},404)
  if(String(opportunity.stage)!=='converted'||!opportunity.conversion_ref)return json({error:'Registre primeiro a conversão e sua referência no pipeline'},409)

  const existing=await db.prepare(`SELECT * FROM academy_commercial_conversion_evidence WHERE tenant_id=? AND opportunity_id=? AND evidence_system=? AND evidence_ref=? LIMIT 1`)
    .bind(auth.tenantId,opportunityId,evidenceSystem,evidenceRef).first()
  if(existing)return json({data:mapEvidence(existing),idempotent:true})

  const id=crypto.randomUUID(),now=new Date().toISOString()
  try{await db.batch([
    db.prepare(`INSERT INTO academy_commercial_conversion_evidence (
      id,tenant_id,opportunity_id,evidence_system,evidence_ref,attributed_value_cents,currency,confirmed_at,recorded_by,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id,auth.tenantId,opportunityId,evidenceSystem,evidenceRef,attributedValueCents,currency,confirmedAt,auth.userId,now),
    auditStatement(db,auth,{action:'commercial_conversion.evidence_recorded',resourceType:'commercial_conversion_evidence',resourceId:id,metadata:{opportunityId,evidenceSystem,evidenceRef,attributedValueCents,currency,confirmedAt,conversionRef:opportunity.conversion_ref}}),
  ])}catch{return json({error:'Não foi possível registrar a evidência de conversão'},409)}
  const created=await db.prepare('SELECT * FROM academy_commercial_conversion_evidence WHERE tenant_id=? AND id=?').bind(auth.tenantId,id).first()
  return json({data:mapEvidence(created)},201)
}
