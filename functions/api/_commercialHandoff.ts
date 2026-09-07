export const COMMERCIAL_HANDOFF_DESTINATIONS=['ifarm_core','crm','partner','other'] as const
export const COMMERCIAL_EVIDENCE_SYSTEMS=[
  'ifarm_core','ifarm_store','ifarm_services','ifarm_finance','ifarm_insurance','crm','payment','contract','order','partner','other',
] as const
export type CommercialHandoffDestination=typeof COMMERCIAL_HANDOFF_DESTINATIONS[number]
export type CommercialEvidenceSystem=typeof COMMERCIAL_EVIDENCE_SYSTEMS[number]

export function isCommercialHandoffDestination(value:unknown):value is CommercialHandoffDestination{
  return (COMMERCIAL_HANDOFF_DESTINATIONS as readonly unknown[]).includes(value)
}
export function isCommercialEvidenceSystem(value:unknown):value is CommercialEvidenceSystem{
  return (COMMERCIAL_EVIDENCE_SYSTEMS as readonly unknown[]).includes(value)
}

export function buildCommercialHandoffPayload(opportunity:any){
  return {
    opportunityId:String(opportunity.id),
    sourceType:String(opportunity.source_type),
    sourceRef:String(opportunity.source_ref),
    sourceInstanceRef:opportunity.source_instance_ref?String(opportunity.source_instance_ref):null,
    interestCode:String(opportunity.interest_code),
    offerSystem:opportunity.offer_system?String(opportunity.offer_system):null,
    offerRef:opportunity.offer_ref?String(opportunity.offer_ref):null,
    offerLabel:opportunity.offer_label_snapshot?String(opportunity.offer_label_snapshot):null,
    consentEvidenceType:String(opportunity.consent_evidence_type),
    consentVersion:opportunity.consent_version?String(opportunity.consent_version):null,
    consentRecordedAt:String(opportunity.consent_recorded_at),
    stage:String(opportunity.stage),
    conversionRef:opportunity.conversion_ref?String(opportunity.conversion_ref):null,
    updatedAt:String(opportunity.updated_at),
  }
}

export function normalizeAttributedValue(value:unknown):number|null|undefined{
  if(value===undefined||value===null||value==='')return null
  const number=Number(value)
  if(!Number.isInteger(number)||number<0||number>9_000_000_000_000)return undefined
  return number
}

export function normalizeCurrency(value:unknown):string|null{
  const currency=String(value??'BRL').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(currency)?currency:null
}
