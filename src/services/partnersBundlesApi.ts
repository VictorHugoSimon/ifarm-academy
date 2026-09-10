import { authenticatedJson } from './authenticatedFetch'
import type { PublicBrand } from './publicPortalApi'

export interface PublicPartner {
  id:string; slug:string; displayName:string; description:string; partnerType:string;
  logoRef?:string|null; websiteUrl?:string|null; featured:boolean
}
export interface PublicBundleSummary {
  id:string; slug:string; title:string; description:string; featured:boolean;
  commercialMode:'free'|'priced'|'contact_sales'; listPriceCents?:number|null; currency:string; coverRef?:string|null; itemCount?:number
}
export interface PublicBundleDetail extends PublicBundleSummary {
  seoTitle?:string|null; seoDescription?:string|null; checkoutReady:false;
  courses:Array<{id:string;slug:string;title:string;category?:string|null;coverRef?:string|null;position:number}>;
  paths:Array<{id:string;slug:string;title:string;description:string;position:number}>;
  plans:Array<{id:string;slug:string;title:string;description:string;position:number}>;
  externalItems:Array<{sourceSystem:string;label:string;description:string;itemType:string;position:number}>;
  partners:Array<{id:string;slug:string;displayName:string;logoRef?:string|null;partnerType:string;position:number}>;
}
export interface PublicPartnerDetail extends PublicPartner { bundles:PublicBundleSummary[] }

export interface PartnerAdmin extends PublicPartner {
  sourceSystem:string; externalRef:string; status:'hidden'|'public'; createdAt:string; updatedAt:string
}
export interface BundleAdmin extends Omit<PublicBundleDetail,'checkoutReady'|'courses'|'paths'|'plans'|'partners'|'externalItems'> {
  status:'hidden'|'public';
  courses:Array<{id:string;label:string;position:number}>;
  paths:Array<{id:string;label:string;position:number}>;
  plans:Array<{id:string;label:string;position:number}>;
  partners:Array<{id:string;label:string;position:number}>;
  externalItems:Array<{id:string;sourceSystem:string;externalRef:string;label:string;description:string;itemType:string;position:number}>;
  createdAt:string; updatedAt:string
}

async function publicRequest<T>(url:string):Promise<T>{
  const response=await fetch(url,{headers:{accept:'application/json'}})
  const payload=await response.json().catch(()=>null)
  if(!response.ok)throw new Error(payload?.error??`Academy API ${response.status}`)
  return payload as T
}

export async function loadPublicPartners(){return publicRequest<{brand:PublicBrand;data:PublicPartner[]}>('/api/public/partners')}
export async function loadPublicPartner(slug:string){return publicRequest<{brand:PublicBrand;data:PublicPartnerDetail}>(`/api/public/partner/${encodeURIComponent(slug)}`)}
export async function loadPublicBundles(){return publicRequest<{brand:PublicBrand;data:PublicBundleSummary[]}>('/api/public/bundles')}
export async function loadPublicBundle(slug:string){return publicRequest<{brand:PublicBrand;data:PublicBundleDetail}>(`/api/public/bundle/${encodeURIComponent(slug)}`)}

export async function loadPartnerAdmin(){return (await authenticatedJson<{data:PartnerAdmin[]}>('/api/public-partners')).data}
export async function savePartnerAdmin(input:{
  partnerId?:string;slug:string;displayName:string;description:string;partnerType:string;sourceSystem?:string;externalRef?:string;
  logoRef?:string|null;websiteUrl?:string|null;status:'hidden'|'public';featured:boolean
}){return authenticatedJson('/api/public-partners',{method:input.partnerId?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)})}

export async function loadBundleAdmin(){return (await authenticatedJson<{data:BundleAdmin[]}>('/api/public-bundles')).data}
export async function saveBundleAdmin(input:{
  bundleId?:string;slug:string;title:string;description:string;status:'hidden'|'public';featured:boolean;
  commercialMode:'free'|'priced'|'contact_sales';listPriceCents?:number|null;currency:string;coverRef?:string|null;
  seoTitle?:string|null;seoDescription?:string|null;courseIds:string[];pathIds:string[];planIds:string[];partnerIds:string[];
  externalItems:Array<{sourceSystem:string;externalRef:string;label:string;description:string;itemType:string}>
}){return authenticatedJson('/api/public-bundles',{method:input.bundleId?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)})}

export function formatBundlePrice(bundle:Pick<PublicBundleSummary,'commercialMode'|'listPriceCents'|'currency'>){
  if(bundle.commercialMode==='free')return 'Gratuito'
  if(bundle.commercialMode==='contact_sales')return 'Fale com vendas'
  if(bundle.listPriceCents==null)return 'Preço em definição'
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:bundle.currency||'BRL'}).format(bundle.listPriceCents/100)
}
