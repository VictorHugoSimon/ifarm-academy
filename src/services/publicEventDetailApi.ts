import type { PublicBrand, PublicEvent } from './publicPortalApi'

export async function loadPublicEventDetail(id:string){
  const response=await fetch(`/api/public/event/${encodeURIComponent(id)}`,{headers:{accept:'application/json'}})
  const payload=await response.json().catch(()=>null)
  if(!response.ok)throw new Error(payload?.error??`Academy API ${response.status}`)
  return payload as {brand:PublicBrand;data:PublicEvent}
}
