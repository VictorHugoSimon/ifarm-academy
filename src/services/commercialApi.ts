export type CommercialSourceType='course_completion'|'certificate_issued'|'event'|'learning_path'|'plan'
export type CommercialOfferSystem='ifarm_core'|'ifarm_store'|'ifarm_services'|'ifarm_finance'|'ifarm_insurance'|'academy'|'partner'|'other'
export type CommercialStage='new'|'qualified'|'contacted'|'opportunity'|'converted'|'discarded'
export type CommercialRuleStatus='draft'|'active'|'archived'

export interface CommercialRecommendation{
  ruleId:string;sourceType:CommercialSourceType;sourceRef:string;interestCode:string
  offerSystem:CommercialOfferSystem;offerRef:string;offerLabel:string;offerDescription:string;ctaLabel:string
  consentPurpose:string;consentText:string;consentVersion:string;priority:number;alreadyOptedIn:boolean
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

async function request<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{...init,headers:{accept:'application/json','content-type':'application/json',...(init?.headers??{})}})
  const payload=await response.json().catch(()=>null)
  if(!response.ok){
    const message=payload&&typeof payload.error==='string'?payload.error:`Academy API ${response.status}`
    throw new Error(message)
  }
  return payload as T
}

function query(params:Record<string,string|undefined>){
  const search=new URLSearchParams()
  Object.entries(params).forEach(([key,value])=>{if(value)search.set(key,value)})
  const text=search.toString()
  return text?`?${text}`:''
}

export async function loadCommercialRecommendations(sourceType:CommercialSourceType,sourceRef:string){
  return request<{data:CommercialRecommendation[];eligible:boolean;reason?:string;sourceInstanceRef?:string|null}>(
    `/api/commercial-recommendations${query({sourceType,sourceRef})}`,
  )
}

export async function grantCommercialOptIn(ruleId:string,consentVersion:string){
  return request<{data:CommercialOpportunity;idempotent?:boolean}>('/api/commercial-opt-in',{
    method:'POST',body:JSON.stringify({ruleId,consent:true,consentVersion}),
  })
}

export async function loadCommercialRules(filters?:{sourceType?:CommercialSourceType;status?:CommercialRuleStatus}){
  return (await request<{data:CommercialRule[]}>(`/api/commercial-rules${query(filters??{})}`)).data
}

export async function createCommercialRule(input:{
  sourceType:CommercialSourceType;sourceRef:string;interestCode:string;offerSystem:CommercialOfferSystem;offerRef:string
  offerLabel:string;offerDescription?:string;ctaLabel?:string;consentPurpose:string;consentText:string;consentVersion:string
  priority?:number;status?:CommercialRuleStatus;activeFrom?:string|null;activeUntil?:string|null
}){
  return (await request<{data:CommercialRule}>('/api/commercial-rules',{method:'POST',body:JSON.stringify(input)})).data
}

export async function updateCommercialRule(ruleId:string,input:Partial<Omit<CommercialRule,'id'|'sourceType'|'sourceRef'|'createdAt'|'createdBy'>>){
  return (await request<{data:CommercialRule}>('/api/commercial-rules',{method:'PUT',body:JSON.stringify({ruleId,...input})})).data
}

export async function loadCommercialOpportunities(filters?:{stage?:CommercialStage;sourceType?:CommercialSourceType;offerSystem?:CommercialOfferSystem;interestCode?:string;userId?:string}){
  return (await request<{data:CommercialOpportunity[]}>(`/api/commercial-opportunities${query(filters??{})}`)).data
}

export async function updateCommercialOpportunity(opportunityId:string,input:{stage?:CommercialStage;assignedToUserId?:string|null;conversionRef?:string|null}){
  return (await request<{data:CommercialOpportunity}>('/api/commercial-opportunities',{method:'PUT',body:JSON.stringify({opportunityId,...input})})).data
}
