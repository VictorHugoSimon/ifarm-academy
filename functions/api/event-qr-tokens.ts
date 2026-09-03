import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { createEventToken, hashEventToken, validateTokenWindow } from './_smartFarm'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const PURPOSES = ['checkin','checkout','station']

function iso(value: unknown): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const eventId = new URL(request.url).searchParams.get('eventId')?.trim() ?? ''
  if (!eventId) return json({ error:'eventId é obrigatório' },400)

  const event = await db.prepare('SELECT id FROM academy_events WHERE tenant_id=? AND id=? AND smart_farm_experience=1 LIMIT 1').bind(auth.tenantId,eventId).first()
  if (!event) return json({ error:'Smart Farm Experience não encontrada' },404)

  const rows = await db.prepare(`
    SELECT t.id,t.event_id,t.purpose,t.agenda_item_id,t.valid_from,t.valid_until,
      t.active,t.use_count,t.max_uses,t.created_at,t.revoked_at,a.title AS agenda_title
    FROM academy_event_qr_tokens t
    LEFT JOIN academy_smart_farm_agenda_items a
      ON a.tenant_id=t.tenant_id AND a.id=t.agenda_item_id
    WHERE t.tenant_id=? AND t.event_id=?
    ORDER BY t.created_at DESC
  `).bind(auth.tenantId,eventId).all()

  return json({ data:(rows.results as any[]).map((row)=>({
    id:row.id,eventId:row.event_id,purpose:row.purpose,agendaItemId:row.agenda_item_id??null,
    agendaTitle:row.agenda_title??null,validFrom:row.valid_from,validUntil:row.valid_until,
    active:Number(row.active)===1,useCount:Number(row.use_count??0),maxUses:row.max_uses==null?null:Number(row.max_uses),
    createdAt:row.created_at,revokedAt:row.revoked_at??null,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body:Record<string,unknown>
  try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}

  const eventId=String(body.eventId??'').trim()
  const purpose=String(body.purpose??'checkin').trim()
  const agendaItemId=String(body.agendaItemId??'').trim()||null
  const maxUsesRaw=body.maxUses==null||body.maxUses===''?null:Number(body.maxUses)
  if(!eventId||!PURPOSES.includes(purpose))return json({error:'eventId ou purpose inválido'},400)
  if(purpose==='station'&&!agendaItemId)return json({error:'Token de estação exige agendaItemId'},400)
  if(maxUsesRaw!=null&&(!Number.isInteger(maxUsesRaw)||maxUsesRaw<1))return json({error:'maxUses deve ser inteiro positivo'},400)

  const event=await db.prepare('SELECT * FROM academy_events WHERE tenant_id=? AND id=? AND smart_farm_experience=1 LIMIT 1').bind(auth.tenantId,eventId).first()
  if(!event)return json({error:'Smart Farm Experience não encontrada neste tenant'},404)
  if(String(event.status)==='cancelled')return json({error:'Evento cancelado não aceita tokens'},409)

  let agenda:any=null
  if(agendaItemId){
    agenda=await db.prepare('SELECT * FROM academy_smart_farm_agenda_items WHERE tenant_id=? AND event_id=? AND id=? LIMIT 1').bind(auth.tenantId,eventId,agendaItemId).first()
    if(!agenda)return json({error:'Item de agenda não encontrado neste evento'},404)
  }

  const defaultFrom=new Date(new Date(event.starts_at).getTime()-2*60*60*1000).toISOString()
  const defaultUntil=new Date(new Date(event.ends_at).getTime()+2*60*60*1000).toISOString()
  const validFrom=body.validFrom?iso(body.validFrom):defaultFrom
  const validUntil=body.validUntil?iso(body.validUntil):defaultUntil
  if(!validFrom||!validUntil)return json({error:'Janela temporal inválida'},400)
  const windowError=validateTokenWindow(String(event.starts_at),String(event.ends_at),validFrom,validUntil)
  if(windowError)return json({error:windowError},400)

  const rawToken=createEventToken()
  const tokenHash=await hashEventToken(rawToken)
  const id=crypto.randomUUID()
  const now=new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO academy_event_qr_tokens (
      id,tenant_id,event_id,purpose,agenda_item_id,token_hash,valid_from,valid_until,
      active,use_count,max_uses,created_by,created_at
    ) VALUES (?,?,?,?,?,?,?,?,1,0,?,?,?)`).bind(
      id,auth.tenantId,eventId,purpose,agendaItemId,tokenHash,validFrom,validUntil,maxUsesRaw,auth.userId,now,
    ),
    auditStatement(db,auth,{
      action:'smart_farm.qr_token_created',resourceType:'event_qr_token',resourceId:id,
      metadata:{eventId,purpose,agendaItemId,validFrom,validUntil,maxUses:maxUsesRaw},
    }),
  ])

  return json({ data:{
    id,eventId,purpose,agendaItemId,agendaTitle:agenda?.title??null,validFrom,validUntil,maxUses:maxUsesRaw,
    rawToken,notice:'O token bruto é exibido somente nesta resposta. O banco armazena apenas SHA-256.',createdAt:now,
  } },201)
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin'])
  if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  const tokenId=new URL(request.url).searchParams.get('tokenId')?.trim()??''
  if(!tokenId)return json({error:'tokenId é obrigatório'},400)
  const token=await db.prepare('SELECT * FROM academy_event_qr_tokens WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId,tokenId).first()
  if(!token)return json({error:'Token não encontrado neste tenant'},404)
  if(Number(token.active)!==1)return json({data:{id:tokenId,active:false},idempotent:true})
  const now=new Date().toISOString()
  await db.batch([
    db.prepare('UPDATE academy_event_qr_tokens SET active=0,revoked_at=? WHERE tenant_id=? AND id=?').bind(now,auth.tenantId,tokenId),
    auditStatement(db,auth,{action:'smart_farm.qr_token_revoked',resourceType:'event_qr_token',resourceId:tokenId,metadata:{eventId:token.event_id,purpose:token.purpose}}),
  ])
  return json({data:{id:tokenId,active:false,revokedAt:now}})
}
