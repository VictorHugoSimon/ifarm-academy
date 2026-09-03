import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, safeJson, type Env } from './_shared'

const EVIDENCE_TYPES=['manual','geolocation','signature','document','asset_reference','checklist']

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin','academy_instructor'])
  if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  const url=new URL(request.url)
  const eventId=url.searchParams.get('eventId')?.trim()??''
  const registrationId=url.searchParams.get('registrationId')?.trim()??''
  if(!eventId)return json({error:'eventId é obrigatório'},400)
  const event=await db.prepare('SELECT id FROM academy_events WHERE tenant_id=? AND id=? AND smart_farm_experience=1 LIMIT 1').bind(auth.tenantId,eventId).first()
  if(!event)return json({error:'Smart Farm Experience não encontrada'},404)
  const rows=await db.prepare(`
    SELECT pe.*,a.title AS agenda_title,r.display_name_snapshot
    FROM academy_event_practical_evidence pe
    JOIN academy_smart_farm_agenda_items a
      ON a.tenant_id=pe.tenant_id AND a.id=pe.agenda_item_id
    JOIN academy_event_registrations r
      ON r.tenant_id=pe.tenant_id AND r.id=pe.registration_id
    WHERE pe.tenant_id=? AND pe.event_id=? AND (?='' OR pe.registration_id=?)
    ORDER BY pe.created_at DESC
  `).bind(auth.tenantId,eventId,registrationId,registrationId).all()
  return json({data:(rows.results as any[]).map((row)=>({
    id:row.id,eventId:row.event_id,registrationId:row.registration_id,displayName:row.display_name_snapshot,
    agendaItemId:row.agenda_item_id,agendaTitle:row.agenda_title,evidenceType:row.evidence_type,
    evidence:safeJson(row.evidence_json,{}),status:row.status,submittedBy:row.submitted_by,
    validatedBy:row.validated_by??null,validatedAt:row.validated_at??null,validationNote:row.validation_note??null,
    createdAt:row.created_at,updatedAt:row.updated_at,
  }))})
}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin','academy_instructor'])
  if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const registrationId=String(body.registrationId??'').trim()
  const agendaItemId=String(body.agendaItemId??'').trim()
  const evidenceType=String(body.evidenceType??'manual').trim()
  const evidence=body.evidence&&typeof body.evidence==='object'?body.evidence as Record<string,unknown>:{}
  if(!registrationId||!agendaItemId)return json({error:'registrationId e agendaItemId são obrigatórios'},400)
  if(!EVIDENCE_TYPES.includes(evidenceType))return json({error:'evidenceType inválido'},400)
  const relation=await db.prepare(`
    SELECT r.id AS registration_id,r.event_id,r.status,a.id AS agenda_item_id,a.title AS agenda_title
    FROM academy_event_registrations r
    JOIN academy_smart_farm_agenda_items a
      ON a.tenant_id=r.tenant_id AND a.event_id=r.event_id
    JOIN academy_events e ON e.tenant_id=r.tenant_id AND e.id=r.event_id
    WHERE r.tenant_id=? AND r.id=? AND a.id=? AND e.smart_farm_experience=1 LIMIT 1
  `).bind(auth.tenantId,registrationId,agendaItemId).first()
  if(!relation)return json({error:'Inscrição/atividade não pertencem à mesma Smart Farm Experience'},404)
  if(String(relation.status)==='cancelled'||String(relation.status)==='waitlisted')return json({error:'Inscrição não está habilitada para evidência prática'},409)
  const id=crypto.randomUUID(),now=new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO academy_event_practical_evidence (
      id,tenant_id,event_id,registration_id,agenda_item_id,evidence_type,evidence_json,status,
      submitted_by,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,'pending',?,?,?)`).bind(
      id,auth.tenantId,relation.event_id,registrationId,agendaItemId,evidenceType,JSON.stringify(evidence),auth.userId,now,now,
    ),
    auditStatement(db,auth,{action:'smart_farm.practical_evidence_submitted',resourceType:'event_practical_evidence',resourceId:id,metadata:{eventId:relation.event_id,registrationId,agendaItemId,evidenceType}}),
  ])
  return json({data:{id,eventId:relation.event_id,registrationId,agendaItemId,agendaTitle:relation.agenda_title,evidenceType,evidence,status:'pending',createdAt:now}},201)
}

export const onRequestPut=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin','academy_instructor'])
  if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}
  const evidenceId=String(body.evidenceId??'').trim(),action=String(body.action??'').trim(),note=String(body.note??'').trim()||null
  if(!evidenceId||!['validate','reject'].includes(action))return json({error:'evidenceId ou action inválido'},400)
  if(action==='reject'&&!note)return json({error:'Rejeição exige justificativa'},400)
  const current=await db.prepare('SELECT * FROM academy_event_practical_evidence WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId,evidenceId).first()
  if(!current)return json({error:'Evidência não encontrada neste tenant'},404)
  if(String(current.status)!=='pending')return json({error:'Somente evidência pendente pode ser revisada'},409)
  const status=action==='validate'?'validated':'rejected',now=new Date().toISOString()
  await db.batch([
    db.prepare(`UPDATE academy_event_practical_evidence SET status=?,validated_by=?,validated_at=?,validation_note=?,updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(status,auth.userId,now,note,now,auth.tenantId,evidenceId),
    auditStatement(db,auth,{action:`smart_farm.practical_evidence_${status}`,resourceType:'event_practical_evidence',resourceId:evidenceId,metadata:{eventId:current.event_id,registrationId:current.registration_id,agendaItemId:current.agenda_item_id}}),
  ])
  return json({data:{id:evidenceId,status,validatedBy:auth.userId,validatedAt:now,validationNote:note}})
}
