import { authenticatedJson } from './authenticatedFetch'
import type { PublicBrand, PublicSearchType } from './publicPortalApi'

export type RecommendationSurface='home'|'course'|'path'|'instructor'|'event'|'plan'|'partner'|'bundle'
export type RecommendationItemType=PublicSearchType

export interface RecommendationAdminItem { itemType:RecommendationItemType; itemRef:string; editorialLabel?:string|null; editorialReason?:string|null; position:number }
export interface RecommendationAdminSet {
  id:string; recommendationKey:string; title:string; subtitle:string; surface:RecommendationSurface; contextRef:string;
  status:'hidden'|'public'; priority:number; validFrom?:string|null; validUntil?:string|null; items:RecommendationAdminItem[]; createdAt:string; updatedAt:string
}
export interface RecommendationCatalogItem { id:string; label:string; meta?:string|null }
export type RecommendationCatalog=Record<RecommendationItemType,RecommendationCatalogItem[]>
export interface PublicRecommendationItem {
  type:RecommendationItemType; id:string; slug?:string|null; title:string; description:string; category?:string|null; imageRef?:string|null; href:string;
  editorialLabel?:string|null; editorialReason?:string|null; position:number
}
export interface PublicRecommendationSet { id:string; key:string; title:string; subtitle:string; surface:RecommendationSurface; contextRef:string; priority:number; items:PublicRecommendationItem[] }
export interface PublicRecommendationResponse {
  brand:PublicBrand; data:PublicRecommendationSet[];
  policy:{strategy:'editorial_curated';behavioralPersonalization:false;commercialProfiling:false;visitorHistoryUsed:false;automaticLeadGeneration:false}
}

async function publicRequest<T>(url:string):Promise<T>{
  const response=await fetch(url,{headers:{accept:'application/json'}})
  const payload=await response.json().catch(()=>null)
  if(!response.ok)throw new Error(payload?.error??`Academy API ${response.status}`)
  return payload as T
}

export async function loadRecommendationAdmin(){return (await authenticatedJson<{data:RecommendationAdminSet[]}>('/api/public-recommendations')).data}
export async function loadRecommendationCatalog(){return (await authenticatedJson<{data:RecommendationCatalog}>('/api/public-recommendation-catalog')).data}
export async function saveRecommendationAdmin(input:{setId?:string;recommendationKey?:string;title:string;subtitle?:string;surface?:RecommendationSurface;contextRef?:string;status:'hidden'|'public';priority:number;validFrom?:string|null;validUntil?:string|null;items:Array<{itemType:RecommendationItemType;itemRef:string;editorialLabel?:string|null;editorialReason?:string|null}>}){
  return authenticatedJson('/api/public-recommendations',{method:input.setId?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)})
}
export async function loadPublicRecommendations(input:{surface?:RecommendationSurface;contextRef?:string}={}):Promise<PublicRecommendationResponse>{
  const url=new URL('/api/public/recommendations',window.location.origin);url.searchParams.set('surface',input.surface??'home');if(input.contextRef)url.searchParams.set('contextRef',input.contextRef)
  return publicRequest<PublicRecommendationResponse>(url.pathname+url.search)
}
