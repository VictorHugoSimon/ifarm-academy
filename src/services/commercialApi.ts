import { authenticatedJson } from './authenticatedFetch'

export type CommercialSourceType='course_completion'|'certificate_issued'|'event'|'learning_path'|'plan'
export type CommercialOfferSystem='ifarm_core'|'ifarm_store'|'ifarm_services'|'ifarm_finance'|'ifarm_insurance'|'academy'|'partner'|'other'
export type CommercialStage='new'|'qualified'|'contacted'|'opportunity'|'converted'|'discarded'
export type CommercialRuleStatus='draft'|'active'|'archived'
export type CommercialHandoffDestination='ifarm_core'|'crm'|'partner'|'other'
export type CommercialHandoffStatus='pending'|'processing'|'delivered'|'failed'|'cancelled'
export type CommercialEvidenceSystem='ifarm_core'|'ifarm_store'|'ifarm_services'|'ifarm_finance'|'ifarm_insurance'|'crm'|'payment'|'contract'|'order'|'partner'|'other'
export type GlobalCommercialContactState='available'|'suppressed'
export type OpportunityCommercialConsentState='granted'|'revoked'

export interface CommercialRecommendation{
  ruleId:string;sourceType:CommercialSourceType;sourceRef:string;interestCode:string
  offerSystem:CommercialOfferSystem;offerRef:string;offerLabel:string;offerDescription:string;ctaLabel:string
  consentPurpose:string;consentText:string;consentVersion:string;priority:number;alreadyOptedIn:boolean
  opportunityId?:string|null;consentState?:OpportunityCommercialConsentState|null;contactAllowed:boolean
}
export interface CommercialRule{
  id:string;sourceType:CommercialSourceType;sourceRef:string;interestCode:string;offerSystem:CommercialOfferSystem;offerRef:string
  offerLabel:string;offerDescription:string;ctaLabel:string;consentPurpose:string;consentText:string;consentVersion:string
  priority:number;status:CommercialRuleStatus;activeFrom?:string|null;activeUntil?:string|null;createdBy?:string;createdAt?:string;updatedAt?:string
}
export interface CommercialOpportunity{
  id:string;userId:string;companyId?:string|null;sourceType:CommercialSourceType;sourceRef:string;sourceInstanceRef?:string|null
  ruleId?:string|null;legacyEventLeadId?:string|null;interestCode:string;offerSystem?:CommercialOfferSystem|null;offerRef?:string|null
  offerLabel?:string|null;consentEvidenceType:string;consentSource:string;consentPurpose?:string|null;consentText?:string|null
  consentVersion?:string|null;consentRecordedAt:string;stage:CommercialStage;assignedToUserId?:string|null
  conversionRef?:string|null;convertedAt?:string|null;createdAt:string;updatedAt:string
}
export interface CommercialHandoff{
  id:string;opportunityId:string;destinationSystem:CommercialHandoffDestination;eventType:string;payloadVersion:number
  status:CommercialHandoffStatus;attempts:number;nextAttemptAt?:string|null;deliveryReference?:string|null;lastErrorCode?:string|null
  requestedBy:string;createdAt:string;updatedAt:string;deliveredAt?:string|null
}
export interface CommercialConversionEvidence{
  id:string;opportunityId:string;evidenceSystem:CommercialEvidenceSystem;evidenceRef:string;attributedValueCents?:number|null
  currency:string;confirmedAt:string;recordedBy:string;createdAt:string
}
export interface CommercialMetrics{
  generatedAt:string;window:{from:string;to:string}
  funnel:{opportunitiesCreated:number;new:number;qualified:number;contacted:number;opportunity:number;converted:number;discarded:number;explicitRuleOptIns:number;smartFarmInterests:number;cohortConversionRate:number|null;conversionsConfirmedInPeriod:number}
  handoffs:{open:number;pending:number;failed:number;deliveredInPeriod:number}
  attributedCommercialValue:{evidenceCount:number;totalsByCurrency:Array<{currency:string;evidenceCount:number;confirmedAttributedValueCents:number}>}
  bySource:Array<{sourceType:string;opportunities:number;converted:number;conversionRate:number|null}>
  byOfferSystem:Array<{offerSystem:string;opportunities:number;converted:number;conversionRate:number|null}>
  byEvidenceSystem:Array<{evidenceSystem:string;currency:string;evidenceCount:number;confirmedAttributedValueCents:number}>
  accountingDisclaimer:string
}
export interface CommercialPrivacyEvent{action:string;source:string;reason?:string|null;recordedBy:string;createdAt:string;consentVersion?:string|null}
export interface CommercialPrivacyOpportunity{
  id:string;sourceType:CommercialSourceType;sourceRef:string;interestCode:string;offerLabel?:string|null;offerSystem?:CommercialOfferSystem|null;offerRef?:string|null
  consentEvidenceType:string;consentVersion?:string|null;consentRecordedAt:string;stage:CommercialStage;createdAt:string;globalState:GlobalCommercialContactState
  opportunityState:OpportunityCommercialConsentState;contactAllowed:boolean;latestGlobalEvent?:CommercialPrivacyEvent|null;latestOpportunityEvent?:CommercialPrivacyEvent|null
  regrantAvailable:boolean;regrantConsentVersion?:string|null;regrantConsentPurpose?:string|null;regrantConsentText?:string|null
}
export interface CommercialPrivacyView{
  globalState:GlobalCommercialContactState;contactAvailable:boolean;latestGlobalEvent?:CommercialPrivacyEvent|null;opportunities:CommercialPrivacyOpportunity[]
}

function request<T>(url:string,init?:RequestInit):Promise<T>{
  return authenticatedJson<T>(url,{...init,headers:{accept:'application/json','content-type':'application/json',...(init?.headers??{})}})
}
function query(params:Record<string,string|undefined>){const search=new URLSearchParams();Object.entries(params).forEach(([key,value])=>{if(value)search.set(key,value)});const text=search.toString();return text?`?${text}`:''}

export async function loadCommercialRecommendations(sourceType:CommercialSourceType,sourceRef:string){return request<{data:CommercialRecommendation[];eligible:boolean;reason?:string;sourceInstanceRef?:string|null;contactSuppressed:boolean}>(`/api/commercial-recommendations${query({sourceType,sourceRef})}`)}
export async function grantCommercialOptIn(ruleId:string,consentVersion:string){return request<{data:CommercialOpportunity;idempotent?:boolean}>('/api/commercial-opt-in',{method:'POST',body:JSON.stringify({ruleId,consent:true,consentVersion})})}
export async function loadCommercialRules(filters?:{sourceType?:CommercialSourceType;status?:CommercialRuleStatus}){return (await request<{data:CommercialRule[]}>(`/api/commercial-rules${query(filters??{})}`)).data}
export async function createCommercialRule(input:{sourceType:CommercialSourceType;sourceRef:string;interestCode:string;offerSystem:CommercialOfferSystem;offerRef:string;offerLabel:string;offerDescription?:string;ctaLabel?:string;consentPurpose:string;consentText:string;consentVersion:string;priority?:number;status?:CommercialRuleStatus;activeFrom?:string|null;activeUntil?:string|null}){return (await request<{data:CommercialRule}>('/api/commercial-rules',{method:'POST',body:JSON.stringify(input)})).data}
export async function updateCommercialRule(ruleId:string,input:Partial<Omit<CommercialRule,'id'|'sourceType'|'sourceRef'|'createdAt'|'createdBy'>>){return (await request<{data:CommercialRule}>('/api/commercial-rules',{method:'PUT',body:JSON.stringify({ruleId,...input})})).data}
export async function loadCommercialOpportunities(filters?:{stage?:CommercialStage;sourceType?:CommercialSourceType;offerSystem?:CommercialOfferSystem;interestCode?:string;userId?:string}){return (await request<{data:CommercialOpportunity[]}>(`/api/commercial-opportunities${query(filters??{})}`)).data}
export async function updateCommercialOpportunity(opportunityId:string,input:{stage?:CommercialStage;assignedToUserId?:string|null;conversionRef?:string|null}){return (await request<{data:CommercialOpportunity}>('/api/commercial-opportunities',{method:'PUT',body:JSON.stringify({opportunityId,...input})})).data}

export async function loadCommercialHandoffs(filters?:{status?:CommercialHandoffStatus;destinationSystem?:CommercialHandoffDestination}){return (await request<{data:CommercialHandoff[]}>(`/api/commercial-handoffs${query(filters??{})}`)).data}
export async function requestCommercialHandoff(opportunityId:string,destinationSystem:CommercialHandoffDestination='ifarm_core'){return request<{data:CommercialHandoff;idempotent?:boolean}>('/api/commercial-handoffs',{method:'POST',body:JSON.stringify({opportunityId,destinationSystem})})}
export async function updateCommercialHandoff(handoffId:string,input:{action:'processing'|'delivered'|'failed'|'retry'|'cancel';deliveryReference?:string;errorCode?:string;nextAttemptAt?:string}){return (await request<{data:CommercialHandoff}>('/api/commercial-handoffs',{method:'PUT',body:JSON.stringify({handoffId,...input})})).data}
export async function loadCommercialConversionEvidence(opportunityId?:string){return (await request<{data:CommercialConversionEvidence[]}>(`/api/commercial-conversion-evidence${query({opportunityId})}`)).data}
export async function recordCommercialConversionEvidence(input:{opportunityId:string;evidenceSystem:CommercialEvidenceSystem;evidenceRef:string;attributedValueCents?:number|null;currency?:string;confirmedAt?:string}){return request<{data:CommercialConversionEvidence;idempotent?:boolean}>('/api/commercial-conversion-evidence',{method:'POST',body:JSON.stringify(input)})}
export async function loadCommercialMetrics(from?:string,to?:string){return request<CommercialMetrics>(`/api/commercial-metrics${query({from,to})}`)}

export async function loadCommercialPrivacy(){return (await request<{data:CommercialPrivacyView}>('/api/commercial-privacy')).data}
export async function updateCommercialPrivacy(input:{action:'suppress_all'|'resume'|'revoke'|'regrant';opportunityId?:string;consentVersion?:string;reason?:string}){return request<{data:CommercialPrivacyView;idempotent?:boolean}>('/api/commercial-privacy',{method:'POST',body:JSON.stringify(input)})}
export async function updateCommercialPrivacyAdmin(input:{targetUserId:string;action:'suppress_all'|'resume'|'revoke'|'regrant';opportunityId?:string;consentVersion?:string;reason:string}){return request<{data:unknown;idempotent?:boolean}>('/api/commercial-privacy-admin',{method:'POST',body:JSON.stringify(input)})}
