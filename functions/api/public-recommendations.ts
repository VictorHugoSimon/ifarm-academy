import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { boundedText, publicSlug } from './_publicDiscovery'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const SURFACES = new Set(['home','course','path','instructor','event','plan','partner','bundle'])
const ITEM_TYPES = new Set(['course','path','instructor','event','plan','partner','bundle'])
const STATUSES = new Set(['hidden','public'])

interface ItemInput { itemType:string; itemRef:string; editorialLabel:string|null; editorialReason:string|null }

function recommendationItems(value:unknown):ItemInput[]|null {
  if(!Array.isArray(value)) return []
  const out:ItemInput[]=[]
  for(const raw of value.slice(0,20)){
    if(!raw||typeof raw!=='object') return null
    const row=raw as Record<string,unknown>
    const itemType=String(row.itemType??'').trim()
    const itemRef=String(row.itemRef??'').trim().slice(0,180)
    const editorialLabel=boundedText(row.editorialLabel,120)
    const editorialReason=boundedText(row.editorialReason,320)
    if(!ITEM_TYPES.has(itemType)||!itemRef) return null
    if(out.some((item)=>item.itemType===itemType&&item.itemRef===itemRef)) continue
    out.push({itemType,itemRef,editorialLabel,editorialReason})
  }
  return out
}

async function loadItems(db:any,tenantId:string,setId:string){
  const rows=await db.prepare(`SELECT item_type,item_ref,editorial_label,editorial_reason,position
    FROM academy_public_recommendation_items WHERE tenant_id=? AND set_id=? ORDER BY position`).bind(tenantId,setId).all()
  return (rows.results as any[]).map((row)=>({itemType:row.item_type,itemRef:row.item_ref,editorialLabel:row.editorial_label??null,editorialReason:row.editorial_reason??null,position:Number(row.position)}))
}

async function existsRef(db:any,tenantId:string,item:ItemInput,requirePublic:boolean){
  const publicSuffix=requirePublic
  let row:any=null
  if(item.itemType==='course') row=await db.prepare(`SELECT c.id FROM academy_courses c JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id${publicSuffix?" AND cp.visibility='public'":''} WHERE c.tenant_id=? AND c.id=?${publicSuffix?" AND c.status='published'":''}`).bind(tenantId,item.itemRef).first()
  else if(item.itemType==='path') row=await db.prepare(`SELECT id FROM academy_public_learning_paths WHERE tenant_id=? AND id=?${publicSuffix?" AND visibility='public'":''}`).bind(tenantId,item.itemRef).first()
  else if(item.itemType==='instructor') row=await db.prepare(`SELECT p.instructor_id FROM academy_instructor_public_profiles p JOIN academy_instructors i ON i.id=p.instructor_id AND i.tenant_id=p.tenant_id${publicSuffix?" AND i.status='active'":''} WHERE p.tenant_id=? AND p.instructor_id=?${publicSuffix?" AND p.visibility='public'":''}`).bind(tenantId,item.itemRef).first()
  else if(item.itemType==='event') row=await db.prepare(`SELECT id FROM academy_events WHERE tenant_id=? AND id=?${publicSuffix?" AND status='published'":''}`).bind(tenantId,item.itemRef).first()
  else if(item.itemType==='plan') row=await db.prepare(`SELECT id FROM academy_plans WHERE tenant_id=? AND id=?${publicSuffix?" AND status='public'":''}`).bind(tenantId,item.itemRef).first()
  else if(item.itemType==='partner') row=await db.prepare(`SELECT id FROM academy_public_partners WHERE tenant_id=? AND id=?${publicSuffix?" AND status='public'":''}`).bind(tenantId,item.itemRef).first()
  else if(item.itemType==='bundle') row=await db.prepare(`SELECT id FROM academy_public_bundles WHERE tenant_id=? AND id=?${publicSuffix?" AND status='public'":''}`).bind(tenantId,item.itemRef).first()
  return Boolean(row)
}

async function validateContext(db:any,tenantId:string,surface:string,contextRef:string,requirePublic:boolean){
  if(surface==='home') return contextRef==='' ? null : 'Home não aceita contexto'
  return await existsRef(db,tenantId,{itemType:surface,itemRef:contextRef,editorialLabel:null,editorialReason:null},requirePublic)
    ? null : 'Contexto não pertence ao tenant ou não está elegível para publicação'
}

export const onRequestGet=async({env,request}:{env:Env;request:Request})=>{
  const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin']);if(auth instanceof Response)return auth
  const db=dbOr503(env);if(db instanceof Response)return db
  const rows=await db.prepare(`SELECT * FROM academy_public_recommendation_sets WHERE tenant_id=? ORDER BY surface,context_ref,priority,recommendation_key`).bind(auth.tenantId).all()
  const data=[]
  for(const row of rows.results as any[]) data.push({
    id:row.id,recommendationKey:row.recommendation_key,title:row.title,subtitle:row.subtitle??'',surface:row.surface,contextRef:row.context_ref,
    status:row.status,priority:Number(row.priority),validFrom:row.valid_from??null,validUntil:row.valid_until??null,
    items:await loadItems(db,auth.tenantId,String(row.id)),createdAt:row.created_at,updatedAt:row.updated_at,
  })
  return json({data})
}

async function saveSet(db:any,auth:any,body:Record<string,unknown>,existing?:any){
  const id=existing?String(existing.id):crypto.randomUUID()
  const recommendationKey=existing?String(existing.recommendation_key):publicSlug(body.recommendationKey)
  const surface=existing?String(existing.surface):String(body.surface??'home').trim()
  const contextRef=existing?String(existing.context_ref):surface==='home'?'':String(body.contextRef??'').trim().slice(0,180)
  const title=String(body.title??existing?.title??'').trim().slice(0,180)
  const subtitle=String(body.subtitle??existing?.subtitle??'').trim().slice(0,500)
  const status=String(body.status??existing?.status??'hidden')
  const priority=Math.max(0,Math.min(999,Math.trunc(Number(body.priority??existing?.priority??0))))
  const validFrom=body.validFrom===undefined?(existing?.valid_from??null):(body.validFrom?String(body.validFrom):null)
  const validUntil=body.validUntil===undefined?(existing?.valid_until??null):(body.validUntil?String(body.validUntil):null)
  const current=existing?await loadItems(db,auth.tenantId,id):[]
  const items=body.items===undefined?current.map((x:any)=>({itemType:x.itemType,itemRef:x.itemRef,editorialLabel:x.editorialLabel,editorialReason:x.editorialReason})):recommendationItems(body.items)
  if(!recommendationKey||!SURFACES.has(surface)||!STATUSES.has(status)||!title||!items) return {error:'Dados da curadoria inválidos',status:400}
  if(surface!=='home'&&!contextRef)return {error:'Curadoria contextual exige contextRef',status:400}
  if(status==='public'&&!items.length)return {error:'Curadoria pública exige ao menos um item',status:400}
  if(validFrom&&Number.isNaN(Date.parse(validFrom)))return {error:'validFrom inválido',status:400}
  if(validUntil&&Number.isNaN(Date.parse(validUntil)))return {error:'validUntil inválido',status:400}
  if(validFrom&&validUntil&&Date.parse(validFrom)>=Date.parse(validUntil))return {error:'Janela editorial inválida',status:400}
  const contextError=await validateContext(db,auth.tenantId,surface,contextRef,status==='public');if(contextError)return {error:contextError,status:409}
  for(const item of items){if(!await existsRef(db,auth.tenantId,item,status==='public'))return {error:`Item ${item.itemType}/${item.itemRef} não está elegível`,status:409}}
  const now=new Date().toISOString()
  try{
    if(!existing) await db.prepare(`INSERT INTO academy_public_recommendation_sets (id,tenant_id,recommendation_key,title,subtitle,surface,context_ref,status,priority,valid_from,valid_until,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'hidden',?,?,?,?,?,?,?)`).bind(id,auth.tenantId,recommendationKey,title,subtitle,surface,contextRef,priority,validFrom,validUntil,auth.userId,auth.userId,now,now).run()
    else await db.prepare("UPDATE academy_public_recommendation_sets SET status='hidden',updated_at=? WHERE tenant_id=? AND id=?").bind(now,auth.tenantId,id).run()
    await db.prepare('DELETE FROM academy_public_recommendation_items WHERE tenant_id=? AND set_id=?').bind(auth.tenantId,id).run()
    for(let i=0;i<items.length;i++){const item=items[i];await db.prepare(`INSERT INTO academy_public_recommendation_items (id,tenant_id,set_id,item_type,item_ref,editorial_label,editorial_reason,position,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),auth.tenantId,id,item.itemType,item.itemRef,item.editorialLabel,item.editorialReason,i,now).run()}
    await db.prepare(`UPDATE academy_public_recommendation_sets SET title=?,subtitle=?,status=?,priority=?,valid_from=?,valid_until=?,updated_by=?,updated_at=? WHERE tenant_id=? AND id=?`).bind(title,subtitle,status,priority,validFrom,validUntil,auth.userId,now,auth.tenantId,id).run()
    await auditStatement(db,auth,{action:existing?'public_recommendation.updated':'public_recommendation.created',resourceType:'public_recommendation',resourceId:id,metadata:{recommendationKey,surface,contextRef,status,itemCount:items.length,priority}}).run()
  }catch(error){return {error:error instanceof Error?error.message:'Não foi possível salvar curadoria',status:409}}
  return {data:{id,recommendationKey,surface,contextRef,status,updatedAt:now},status:existing?200:201}
}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin']);if(auth instanceof Response)return auth;const db=dbOr503(env);if(db instanceof Response)return db;let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}const result=await saveSet(db,auth,body);return json(result.error?{error:result.error}:{data:result.data},result.status)}
export const onRequestPut=async({env,request}:{env:Env;request:Request})=>{const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin']);if(auth instanceof Response)return auth;const db=dbOr503(env);if(db instanceof Response)return db;let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}const setId=String(body.setId??'').trim();const existing=setId?await db.prepare('SELECT * FROM academy_public_recommendation_sets WHERE tenant_id=? AND id=?').bind(auth.tenantId,setId).first():null;if(!existing)return json({error:'Curadoria não encontrada neste tenant'},404);const result=await saveSet(db,auth,body,existing);return json(result.error?{error:result.error}:{data:result.data},result.status)}
