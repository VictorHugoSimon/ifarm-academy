import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { hashEventToken, tokenIsUsable } from './_smartFarm'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body:Record<string,unknown>
  try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const rawToken=String(body.token??'').trim()
  if(!rawToken)return json({error:'token é obrigatório'},400)

  const tokenHash=await hashEventToken(rawToken)
  const token=await db.prepare(`
    SELECT t.*,e.title AS event_title,e.status AS event_status,e.smart_farm_experience,
      a.title AS agenda_title,a.requires_practical_evidence
    FROM academy_event_qr_tokens t
    JOIN academy_events e ON e.tenant_id=t.tenant_id AND e.id=t.event_id
    LEFT JOIN academy_smart_farm_agenda_items a
      ON a.tenant_id=t.tenant_id AND a.id=t.agenda_item_id
    WHERE t.tenant_id=? AND t.token_hash=? LIMIT 1
  `).bind(auth.tenantId,tokenHash).first()
  if(!token)return json({error:'QR inválido para este tenant'},404)
  if(Number(token.smart_farm_experience)!==1)return json({error:'Token não pertence a uma Smart Farm Experience'},409)
  if(String(token.event_status)==='cancelled')return json({error:'Evento cancelado'},409)
  if(!tokenIsUsable(token))return json({error:'QR expirado, revogado ou sem usos disponíveis'},410)

  const registration=await db.prepare(`
    SELECT * FROM academy_event_registrations
    WHERE tenant_id=? AND event_id=? AND user_id=? LIMIT 1
  `).bind(auth.tenantId,token.event_id,auth.userId).first()
  if(!registration)return json({error:'Você não possui inscrição neste evento'},403)
  if(String(registration.status)==='waitlisted')return json({error:'Participante em lista de espera ainda não pode registrar presença'},409)
  if(String(registration.status)==='cancelled')return json({error:'Inscrição cancelada não pode registrar presença'},409)
  if(String(registration.status)==='no_show')return json({error:'Ausência já registrada; solicite revisão à organização'},409)

  const now=new Date().toISOString()
  const purpose=String(token.purpose)

  if(purpose==='checkin'){
    if(registration.checkin_at){
      return json({data:{purpose,eventId:token.event_id,eventTitle:token.event_title,status:'attended',checkinAt:registration.checkin_at},idempotent:true})
    }
    const evidenceId=crypto.randomUUID()
    await db.batch([
      db.prepare(`UPDATE academy_event_registrations SET status='attended',checkin_at=?,updated_at=? WHERE tenant_id=? AND id=?`)
        .bind(now,now,auth.tenantId,registration.id),
      db.prepare(`INSERT INTO academy_event_attendance_evidence (
        id,tenant_id,event_id,registration_id,evidence_type,evidence_json,recorded_by,created_at
      ) VALUES (?,?,?,?, 'qr', ?, ?, ?)`)
        .bind(evidenceId,auth.tenantId,token.event_id,registration.id,JSON.stringify({tokenId:token.id,purpose:'checkin'}),auth.userId,now),
      db.prepare('UPDATE academy_event_qr_tokens SET use_count=use_count+1 WHERE tenant_id=? AND id=?').bind(auth.tenantId,token.id),
      auditStatement(db,auth,{action:'smart_farm.self_checkin',resourceType:'event_registration',resourceId:registration.id,metadata:{eventId:token.event_id,tokenId:token.id,evidenceId}}),
    ])
    return json({data:{purpose,eventId:token.event_id,eventTitle:token.event_title,status:'attended',checkinAt:now}})
  }

  if(purpose==='checkout'){
    if(String(registration.status)!=='attended'||!registration.checkin_at)return json({error:'Checkout exige check-in anterior'},409)
    if(registration.checkout_at)return json({data:{purpose,eventId:token.event_id,eventTitle:token.event_title,checkoutAt:registration.checkout_at},idempotent:true})
    await db.batch([
      db.prepare('UPDATE academy_event_registrations SET checkout_at=?,updated_at=? WHERE tenant_id=? AND id=?').bind(now,now,auth.tenantId,registration.id),
      db.prepare('UPDATE academy_event_qr_tokens SET use_count=use_count+1 WHERE tenant_id=? AND id=?').bind(auth.tenantId,token.id),
      auditStatement(db,auth,{action:'smart_farm.self_checkout',resourceType:'event_registration',resourceId:registration.id,metadata:{eventId:token.event_id,tokenId:token.id}}),
    ])
    return json({data:{purpose,eventId:token.event_id,eventTitle:token.event_title,checkoutAt:now}})
  }

  if(String(registration.status)!=='attended'||!registration.checkin_at)return json({error:'Registro em estação exige check-in no evento'},409)
  if(!token.agenda_item_id)return json({error:'Token de estação sem agenda vinculada'},409)
  const existingEvidence=await db.prepare(`
    SELECT id,status,created_at FROM academy_event_practical_evidence
    WHERE tenant_id=? AND registration_id=? AND agenda_item_id=? AND evidence_type='qr'
    ORDER BY created_at DESC LIMIT 1
  `).bind(auth.tenantId,registration.id,token.agenda_item_id).first()
  if(existingEvidence){
    return json({data:{purpose:'station',eventId:token.event_id,eventTitle:token.event_title,agendaItemId:token.agenda_item_id,agendaTitle:token.agenda_title,evidenceId:existingEvidence.id,evidenceStatus:existingEvidence.status},idempotent:true})
  }

  const evidenceId=crypto.randomUUID()
  await db.batch([
    db.prepare(`INSERT INTO academy_event_practical_evidence (
      id,tenant_id,event_id,registration_id,agenda_item_id,evidence_type,evidence_json,status,
      submitted_by,validated_by,validated_at,created_at,updated_at
    ) VALUES (?,?,?,?,?,'qr',?,'validated',?,?,?,?,?)`).bind(
      evidenceId,auth.tenantId,token.event_id,registration.id,token.agenda_item_id,
      JSON.stringify({tokenId:token.id,source:'station_qr'}),auth.userId,'system:qr_token',now,now,now,
    ),
    db.prepare('UPDATE academy_event_qr_tokens SET use_count=use_count+1 WHERE tenant_id=? AND id=?').bind(auth.tenantId,token.id),
    auditStatement(db,auth,{action:'smart_farm.station_evidence_recorded',resourceType:'event_practical_evidence',resourceId:evidenceId,metadata:{eventId:token.event_id,agendaItemId:token.agenda_item_id,registrationId:registration.id}}),
  ])
  return json({data:{purpose:'station',eventId:token.event_id,eventTitle:token.event_title,agendaItemId:token.agenda_item_id,agendaTitle:token.agenda_title,evidenceId,evidenceStatus:'validated',recordedAt:now}})
}
