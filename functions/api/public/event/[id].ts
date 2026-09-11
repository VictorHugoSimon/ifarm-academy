import { resolvePublicTenant } from '../../_publicTenant'
import { dbOr503, json, type Env } from '../../_shared'

export const onRequestGet=async({env,request,params}:{env:Env;request:Request;params:{id:string}})=>{
  const db=dbOr503(env);if(db instanceof Response)return db
  const context=await resolvePublicTenant(db,env,request);if(!context)return json({error:'Portal público não configurado para este host'},404)
  const row:any=await db.prepare(`SELECT e.*,
    SUM(CASE WHEN r.status IN ('registered','attended') THEN 1 ELSE 0 END) occupied,
    SUM(CASE WHEN r.status='waitlisted' THEN 1 ELSE 0 END) waitlisted
    FROM academy_events e LEFT JOIN academy_event_registrations r ON r.tenant_id=e.tenant_id AND r.event_id=e.id
    WHERE e.tenant_id=? AND e.id=? AND e.status='published' GROUP BY e.id`).bind(context.tenantId,String(params.id)).first()
  if(!row)return json({error:'Evento público não encontrado'},404)
  return json({brand:context.brand,data:{
    id:row.id,title:row.title,description:row.description??'',eventType:row.event_type,modality:row.modality,accessModel:row.access_model,
    priceCents:row.price_cents==null?null:Number(row.price_cents),currency:row.currency,startsAt:row.starts_at,endsAt:row.ends_at,timezone:row.timezone,
    registrationDeadline:row.registration_deadline??null,capacity:row.capacity==null?null:Number(row.capacity),occupied:Number(row.occupied??0),waitlisted:Number(row.waitlisted??0),
    venueName:row.venue_name??null,addressText:row.address_text??null,smartFarmExperience:Number(row.smart_farm_experience)===1,
    meetingUrl:null,registrationRequiresAuthentication:true,checkoutReady:row.access_model!=='paid',
  }})
}
