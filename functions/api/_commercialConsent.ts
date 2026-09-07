export type GlobalCommercialContactState='available'|'suppressed'
export type OpportunityCommercialConsentState='granted'|'revoked'

export interface CommercialConsentState {
  globalState:GlobalCommercialContactState
  opportunityState:OpportunityCommercialConsentState
  contactAllowed:boolean
}

export function resolveCommercialConsentState(
  latestGlobalAction?:string|null,
  latestOpportunityAction?:string|null,
):CommercialConsentState{
  const globalState:GlobalCommercialContactState=latestGlobalAction==='suppress_all'?'suppressed':'available'
  const opportunityState:OpportunityCommercialConsentState=latestOpportunityAction==='revoked'?'revoked':'granted'
  return {globalState,opportunityState,contactAllowed:globalState==='available'&&opportunityState==='granted'}
}

export async function loadGlobalCommercialContactState(db:any,tenantId:string,userId:string){
  const row=await db.prepare(`SELECT action,source,reason,recorded_by,created_at
    FROM academy_commercial_contact_preference_events
    WHERE tenant_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 1`).bind(tenantId,userId).first()
  return {
    ...resolveCommercialConsentState(row?.action??null,null),
    latestEvent:row?{action:String(row.action),source:String(row.source),reason:row.reason??null,recordedBy:String(row.recorded_by),createdAt:String(row.created_at)}:null,
  }
}

export async function loadOpportunityCommercialConsentState(db:any,tenantId:string,userId:string,opportunityId:string){
  const [globalRow,opportunityRow]=await Promise.all([
    db.prepare(`SELECT action,source,reason,recorded_by,created_at
      FROM academy_commercial_contact_preference_events
      WHERE tenant_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 1`).bind(tenantId,userId).first(),
    db.prepare(`SELECT action,source,consent_version,reason,recorded_by,created_at
      FROM academy_commercial_opportunity_consent_events
      WHERE tenant_id=? AND opportunity_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 1`).bind(tenantId,opportunityId,userId).first(),
  ])
  return {
    ...resolveCommercialConsentState(globalRow?.action??null,opportunityRow?.action??null),
    latestGlobalEvent:globalRow?{action:String(globalRow.action),source:String(globalRow.source),reason:globalRow.reason??null,recordedBy:String(globalRow.recorded_by),createdAt:String(globalRow.created_at)}:null,
    latestOpportunityEvent:opportunityRow?{action:String(opportunityRow.action),source:String(opportunityRow.source),consentVersion:opportunityRow.consent_version??null,reason:opportunityRow.reason??null,recordedBy:String(opportunityRow.recorded_by),createdAt:String(opportunityRow.created_at)}:null,
  }
}

export async function userCommercialContactIsSuppressed(db:any,tenantId:string,userId:string):Promise<boolean>{
  const row=await db.prepare(`SELECT action FROM academy_commercial_contact_preference_events
    WHERE tenant_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 1`).bind(tenantId,userId).first()
  return row?.action==='suppress_all'
}

export async function opportunityCommercialContactIsAllowed(db:any,tenantId:string,userId:string,opportunityId:string):Promise<boolean>{
  const state=await loadOpportunityCommercialConsentState(db,tenantId,userId,opportunityId)
  return state.contactAllowed
}
