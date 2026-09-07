import { requireTrustedContext } from './_auth'
import { isCommercialSourceType, verifyCommercialSourceEligibility } from './_commercial'
import { dbOr503, json, type Env } from './_shared'

function mapRecommendation(row:any){
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
    alreadyOptedIn:Number(row.already_opted_in??0)===1,
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
    return json({data:[],eligible:false,reason:eligibility.reason})
  }

  const now=new Date().toISOString()
  const rows=await db.prepare(`
    SELECT r.*,
      CASE WHEN EXISTS (
        SELECT 1 FROM academy_commercial_opportunities o
        WHERE o.tenant_id=r.tenant_id AND o.user_id=? AND o.source_type=r.source_type
          AND o.source_ref=r.source_ref AND o.rule_id=r.id
      ) THEN 1 ELSE 0 END AS already_opted_in
    FROM academy_commercial_offer_rules r
    WHERE r.tenant_id=? AND r.source_type=? AND r.source_ref=? AND r.status='active'
      AND (r.active_from IS NULL OR datetime(r.active_from)<=datetime(?))
      AND (r.active_until IS NULL OR datetime(r.active_until)>datetime(?))
    ORDER BY r.priority ASC,r.created_at ASC
  `).bind(auth.userId,auth.tenantId,sourceType,sourceRef,now,now).all()

  return json({
    data:(rows.results as any[]).map(mapRecommendation),
    eligible:true,
    sourceInstanceRef:eligibility.sourceInstanceRef,
  })
}
