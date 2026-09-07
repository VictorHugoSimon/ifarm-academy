import { requireTrustedContext } from './_auth'
import { isCommercialSourceType, verifyCommercialSourceEligibility } from './_commercial'
import { loadOpportunityCommercialConsentState, userCommercialContactIsSuppressed } from './_commercialConsent'
import { dbOr503, json, type Env } from './_shared'

function mapRecommendation(row:any,extra:{opportunityId:string|null;consentState:'granted'|'revoked'|null;contactAllowed:boolean}){
  return {
    ruleId:String(row.id),
    sourceType:String(row.source_type),
    sourceRef:String(row.source_ref),
    interestCode:String(row.interest_code),
    offerSystem:String(row.offer_system),
    offerRef:String(row.offer_ref),
    offerLabel:String(row.offer_label),
    offerDescription:String(row.offer_description??''),
    ctaLabel:String(row.cta_label??'Tenho interesse'),
    consentPurpose:String(row.consent_purpose),
    consentText:String(row.consent_text),
    consentVersion:String(row.consent_version),
    priority:Number(row.priority??100),
    alreadyOptedIn:Boolean(extra.opportunityId)&&extra.consentState==='granted',
    opportunityId:extra.opportunityId,
    consentState:extra.consentState,
    contactAllowed:extra.contactAllowed,
  }
}

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireTrustedContext(env,request)
  if(auth instanceof Response)return auth
  const db=dbOr503(env)
  if(db instanceof Response)return db

  const url=new URL(request.url)
  const sourceType=url.searchParams.get('sourceType')?.trim()??''
  const sourceRef=url.searchParams.get('sourceRef')?.trim()??''
  if(!isCommercialSourceType(sourceType)||!sourceRef||sourceRef.length>180){
    return json({error:'sourceType/sourceRef inválido'},400)
  }

  const eligibility=await verifyCommercialSourceEligibility(db,auth.tenantId,auth.userId,sourceType,sourceRef)
  if(!eligibility.eligible){
    return json({data:[],eligible:false,reason:eligibility.reason,contactSuppressed:false})
  }

  const contactSuppressed=await userCommercialContactIsSuppressed(db,auth.tenantId,auth.userId)
  const now=new Date().toISOString()
  const rows=await db.prepare(`
    SELECT r.*
    FROM academy_commercial_offer_rules r
    WHERE r.tenant_id=? AND r.source_type=? AND r.source_ref=? AND r.status='active'
      AND (r.active_from IS NULL OR datetime(r.active_from)<=datetime(?))
      AND (r.active_until IS NULL OR datetime(r.active_until)>datetime(?))
    ORDER BY r.priority ASC,r.created_at ASC
  `).bind(auth.tenantId,sourceType,sourceRef,now,now).all()

  const data=await Promise.all((rows.results as any[]).map(async(row)=>{
    const opportunity=await db.prepare(`SELECT id FROM academy_commercial_opportunities
      WHERE tenant_id=? AND user_id=? AND source_type=? AND source_ref=? AND rule_id=? LIMIT 1`)
      .bind(auth.tenantId,auth.userId,sourceType,sourceRef,row.id).first()
    if(!opportunity)return mapRecommendation(row,{opportunityId:null,consentState:null,contactAllowed:!contactSuppressed})
    const state=await loadOpportunityCommercialConsentState(db,auth.tenantId,auth.userId,String(opportunity.id))
    return mapRecommendation(row,{opportunityId:String(opportunity.id),consentState:state.opportunityState,contactAllowed:state.contactAllowed})
  }))

  return json({data,eligible:true,sourceInstanceRef:eligibility.sourceInstanceRef,contactSuppressed})
}
