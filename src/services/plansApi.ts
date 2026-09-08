import { authenticatedJson } from './authenticatedFetch'

export interface PlanPriceAdmin { id:string; billingInterval:'monthly'|'annual'; priceUnit:'subscription'|'per_user'; version:number; amountCents:number; currency:string; status:'draft'|'active'|'retired'; validFrom?:string|null; validUntil?:string|null; createdBy:string; createdAt:string; updatedAt:string }
export interface PlanAdmin {
  id:string; slug:string; name:string; description:string; audienceType:'individual'|'corporate'|'partner'; commercialMode:'free'|'priced'|'contact_sales'; status:'draft'|'public'|'archived'; featured:boolean; maxUsers?:number|null; seoTitle?:string|null; seoDescription?:string|null; createdBy:string; createdAt:string; updatedAt:string;
  prices:PlanPriceAdmin[]; courses:Array<{courseId:string;title:string;publicVisibility:string}>; paths:Array<{pathId:string;title:string;visibility:string}>; externalBenefits:Array<{id:string;sourceSystem:string;externalRef:string;label:string;description:string}>;
}

function request<T>(url:string, init?:RequestInit):Promise<T>{return authenticatedJson<T>(url,{...init,headers:{'content-type':'application/json',...(init?.headers??{})}})}

export async function loadPlans(){return (await request<{data:PlanAdmin[]}>('/api/plans')).data}
export async function createPlan(input:{slug:string;name:string;description?:string;audienceType:PlanAdmin['audienceType'];commercialMode:PlanAdmin['commercialMode'];featured?:boolean;maxUsers?:number|null;seoTitle?:string|null;seoDescription?:string|null}){return request('/api/plans',{method:'POST',body:JSON.stringify(input)})}
export async function savePlan(input:{planId:string;slug:string;name:string;description:string;audienceType:PlanAdmin['audienceType'];commercialMode:PlanAdmin['commercialMode'];status:PlanAdmin['status'];featured:boolean;maxUsers?:number|null;seoTitle?:string|null;seoDescription?:string|null;courseIds:string[];pathIds:string[];externalBenefits:Array<{sourceSystem:string;externalRef:string;label:string;description:string}>}){return request('/api/plans',{method:'PUT',body:JSON.stringify(input)})}
export async function createPlanPrice(input:{planId:string;billingInterval:'monthly'|'annual';priceUnit:'subscription'|'per_user';amountCents:number;validFrom?:string|null;validUntil?:string|null;activate:boolean}){return request('/api/plan-prices',{method:'POST',body:JSON.stringify(input)})}
export async function changePlanPrice(priceId:string,action:'activate'|'retire'){return request('/api/plan-prices',{method:'PUT',body:JSON.stringify({priceId,action})})}
export async function loadSubscriptions(){return request<{data:any[];writeEnabled:false;note:string}>('/api/subscriptions')}
