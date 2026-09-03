export type SmartFarmActivityType='field_activity'|'demonstration'|'lecture'|'visit'|'break'|'other'
export type SmartFarmInterestCode='irrigation'|'iot'|'weather_station'|'lorawan'|'drones'|'precision_agriculture'|'insurance'|'credit'|'technical_services'|'ifarm_store'|'other'
export type SmartFarmTokenPurpose='checkin'|'checkout'|'station'
export type SmartFarmLeadStage='new'|'qualified'|'contacted'|'converted'|'discarded'

export interface SmartFarmAgendaItem{
  id:string;eventId:string;title:string;description:string;activityType:SmartFarmActivityType
  startsAt?:string|null;endsAt?:string|null;position:number;locationLabel?:string|null
  requiresPracticalEvidence:boolean;interestCode?:SmartFarmInterestCode|null;createdAt?:string;updatedAt?:string
}

export interface SmartFarmQrToken{
  id:string;eventId:string;purpose:SmartFarmTokenPurpose;agendaItemId?:string|null;agendaTitle?:string|null
  validFrom:string;validUntil:string;active?:boolean;useCount?:number;maxUses?:number|null;createdAt?:string;revokedAt?:string|null
}

export interface CreatedSmartFarmQrToken extends SmartFarmQrToken{rawToken:string;notice:string}

export interface PracticalEvidence{
  id:string;eventId:string;registrationId:string;displayName?:string;agendaItemId:string;agendaTitle:string
  evidenceType:string;evidence:Record<string,unknown>;status:'pending'|'validated'|'rejected'
  submittedBy:string;validatedBy?:string|null;validatedAt?:string|null;validationNote?:string|null;createdAt:string;updatedAt:string
}

export interface SmartFarmLead{
  id:string;eventId:string;eventTitle?:string;registrationId?:string;userId?:string;displayName?:string;companyId?:string|null
  interestCode:SmartFarmInterestCode;origin?:string;consentSource:string;consentRecordedAt:string;stage:SmartFarmLeadStage;createdAt:string;updatedAt?:string
}

async function request<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{...init,headers:{'content-type':'application/json',...(init?.headers??{})}})
  const payload=await response.json().catch(()=>null)
  if(!response.ok){
    const message=payload&&typeof payload.error==='string'?payload.error:`Academy API ${response.status}`
    throw new Error(message)
  }
  return payload as T
}

export async function loadSmartFarmAgenda(eventId:string):Promise<SmartFarmAgendaItem[]>{
  return (await request<{data:SmartFarmAgendaItem[]}>(`/api/smart-farm-agenda?eventId=${encodeURIComponent(eventId)}`)).data
}
export async function createSmartFarmAgendaItem(input:{eventId:string;title:string;description?:string;activityType:SmartFarmActivityType;startsAt?:string|null;endsAt?:string|null;position?:number;locationLabel?:string|null;requiresPracticalEvidence?:boolean;interestCode?:SmartFarmInterestCode|null}){
  return request<{data:SmartFarmAgendaItem}>('/api/smart-farm-agenda',{method:'POST',body:JSON.stringify(input)})
}
export async function deleteSmartFarmAgendaItem(itemId:string){
  return request<{data:{id:string;deleted:boolean}}>(`/api/smart-farm-agenda?itemId=${encodeURIComponent(itemId)}`,{method:'DELETE'})
}
export async function loadSmartFarmQrTokens(eventId:string):Promise<SmartFarmQrToken[]>{
  return (await request<{data:SmartFarmQrToken[]}>(`/api/event-qr-tokens?eventId=${encodeURIComponent(eventId)}`)).data
}
export async function createSmartFarmQrToken(input:{eventId:string;purpose:SmartFarmTokenPurpose;agendaItemId?:string|null;validFrom?:string|null;validUntil?:string|null;maxUses?:number|null}){
  return (await request<{data:CreatedSmartFarmQrToken}>('/api/event-qr-tokens',{method:'POST',body:JSON.stringify(input)})).data
}
export async function revokeSmartFarmQrToken(tokenId:string){
  return request(`/api/event-qr-tokens?tokenId=${encodeURIComponent(tokenId)}`,{method:'DELETE'})
}
export async function submitSmartFarmQr(token:string){
  return request<{data:Record<string,unknown>;idempotent?:boolean}>('/api/event-self-checkin',{method:'POST',body:JSON.stringify({token})})
}
export async function loadPracticalEvidence(eventId:string):Promise<PracticalEvidence[]>{
  return (await request<{data:PracticalEvidence[]}>(`/api/event-practical-evidence?eventId=${encodeURIComponent(eventId)}`)).data
}
export async function submitPracticalEvidence(input:{registrationId:string;agendaItemId:string;evidenceType:'manual'|'geolocation'|'signature'|'document'|'asset_reference'|'checklist';evidence?:Record<string,unknown>}){
  return request('/api/event-practical-evidence',{method:'POST',body:JSON.stringify(input)})
}
export async function reviewPracticalEvidence(evidenceId:string,action:'validate'|'reject',note?:string){
  return request('/api/event-practical-evidence',{method:'PUT',body:JSON.stringify({evidenceId,action,note})})
}
export async function loadMySmartFarmInterests(eventId?:string):Promise<SmartFarmLead[]>{
  const suffix=eventId?`?eventId=${encodeURIComponent(eventId)}`:''
  return (await request<{data:SmartFarmLead[]}>(`/api/event-interest${suffix}`)).data
}
export async function registerSmartFarmInterest(eventId:string,interestCode:SmartFarmInterestCode){
  return request<{data:SmartFarmLead;idempotent?:boolean}>('/api/event-interest',{method:'POST',body:JSON.stringify({eventId,interestCode,consent:true})})
}
export async function loadSmartFarmLeads(eventId?:string):Promise<SmartFarmLead[]>{
  const suffix=eventId?`?eventId=${encodeURIComponent(eventId)}`:''
  return (await request<{data:SmartFarmLead[]}>(`/api/event-leads${suffix}`)).data
}
export async function updateSmartFarmLeadStage(leadId:string,stage:SmartFarmLeadStage){
  return request('/api/event-leads',{method:'PUT',body:JSON.stringify({leadId,stage})})
}

export function smartFarmCheckinUrl(rawToken:string):string{
  const url=new URL('/smart-farm/checkin',window.location.origin)
  url.searchParams.set('token',rawToken)
  return url.toString()
}
