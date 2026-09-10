import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { boundedText, publicSlug, safePublicAssetRef } from './_publicDiscovery'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const STATUSES = new Set(['hidden','public'])
const COMMERCIAL_MODES = new Set(['free','priced','contact_sales'])
const EXTERNAL_TYPES = new Set(['product','service','finance','insurance','consulting','event','other'])

function uniqueIds(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const raw of value) {
    const id = String(raw ?? '').trim()
    if (id && id.length <= 180 && !out.includes(id)) out.push(id)
    if (out.length >= max) break
  }
  return out
}

interface ExternalInput { sourceSystem:string; externalRef:string; label:string; description:string; itemType:string }
function externalItems(value: unknown): ExternalInput[] | null {
  if (!Array.isArray(value)) return []
  const out: ExternalInput[] = []
  for (const raw of value.slice(0,40)) {
    if (!raw || typeof raw !== 'object') return null
    const row = raw as Record<string,unknown>
    const sourceSystem = String(row.sourceSystem ?? '').trim().slice(0,80)
    const externalRef = String(row.externalRef ?? '').trim().slice(0,180)
    const label = String(row.label ?? '').trim().slice(0,160)
    const description = String(row.description ?? '').trim().slice(0,1000)
    const itemType = String(row.itemType ?? 'service').trim()
    if (!sourceSystem || !externalRef || !label || !EXTERNAL_TYPES.has(itemType)) return null
    if (out.some((item) => item.sourceSystem===sourceSystem && item.externalRef===externalRef)) continue
    out.push({ sourceSystem,externalRef,label,description,itemType })
  }
  return out
}

async function validateRefs(db:any, tenantId:string, input:{courseIds:string[];pathIds:string[];planIds:string[];partnerIds:string[]}, requirePublic:boolean) {
  for (const id of input.courseIds) {
    const row = await db.prepare(`SELECT c.status,cp.visibility FROM academy_courses c LEFT JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id WHERE c.tenant_id=? AND c.id=?`).bind(tenantId,id).first()
    if (!row) return `Curso ${id} não pertence a este tenant`
    if (requirePublic && (String(row.status)!=='published' || String(row.visibility)!=='public')) return `Curso ${id} precisa estar público`
  }
  for (const id of input.pathIds) {
    const row = await db.prepare('SELECT visibility FROM academy_public_learning_paths WHERE tenant_id=? AND id=?').bind(tenantId,id).first()
    if (!row) return `Trilha ${id} não pertence a este tenant`
    if (requirePublic && String(row.visibility)!=='public') return `Trilha ${id} precisa estar pública`
  }
  for (const id of input.planIds) {
    const row = await db.prepare('SELECT status FROM academy_plans WHERE tenant_id=? AND id=?').bind(tenantId,id).first()
    if (!row) return `Plano ${id} não pertence a este tenant`
    if (requirePublic && String(row.status)!=='public') return `Plano ${id} precisa estar público`
  }
  for (const id of input.partnerIds) {
    const row = await db.prepare('SELECT status FROM academy_public_partners WHERE tenant_id=? AND id=?').bind(tenantId,id).first()
    if (!row) return `Parceiro ${id} não pertence a este tenant`
    if (requirePublic && String(row.status)!=='public') return `Parceiro ${id} precisa estar público`
  }
  return null
}

async function loadChildren(db:any, tenantId:string, bundleId:string) {
  const [courses,paths,plans,partners,external] = await Promise.all([
    db.prepare(`SELECT x.course_id AS id,c.title AS label,x.position FROM academy_public_bundle_courses x JOIN academy_courses c ON c.id=x.course_id AND c.tenant_id=x.tenant_id WHERE x.tenant_id=? AND x.bundle_id=? ORDER BY x.position`).bind(tenantId,bundleId).all(),
    db.prepare(`SELECT x.path_id AS id,p.title AS label,x.position FROM academy_public_bundle_paths x JOIN academy_public_learning_paths p ON p.id=x.path_id AND p.tenant_id=x.tenant_id WHERE x.tenant_id=? AND x.bundle_id=? ORDER BY x.position`).bind(tenantId,bundleId).all(),
    db.prepare(`SELECT x.plan_id AS id,p.name AS label,x.position FROM academy_public_bundle_plans x JOIN academy_plans p ON p.id=x.plan_id AND p.tenant_id=x.tenant_id WHERE x.tenant_id=? AND x.bundle_id=? ORDER BY x.position`).bind(tenantId,bundleId).all(),
    db.prepare(`SELECT x.partner_id AS id,p.display_name AS label,x.position FROM academy_public_bundle_partners x JOIN academy_public_partners p ON p.id=x.partner_id AND p.tenant_id=x.tenant_id WHERE x.tenant_id=? AND x.bundle_id=? ORDER BY x.position`).bind(tenantId,bundleId).all(),
    db.prepare(`SELECT id,source_system,external_ref,label,description,item_type,position FROM academy_public_bundle_external_items WHERE tenant_id=? AND bundle_id=? ORDER BY position`).bind(tenantId,bundleId).all(),
  ])
  return {
    courses:(courses.results as any[]).map((r)=>({id:r.id,label:r.label,position:Number(r.position)})),
    paths:(paths.results as any[]).map((r)=>({id:r.id,label:r.label,position:Number(r.position)})),
    plans:(plans.results as any[]).map((r)=>({id:r.id,label:r.label,position:Number(r.position)})),
    partners:(partners.results as any[]).map((r)=>({id:r.id,label:r.label,position:Number(r.position)})),
    externalItems:(external.results as any[]).map((r)=>({id:r.id,sourceSystem:r.source_system,externalRef:r.external_ref,label:r.label,description:r.description,itemType:r.item_type,position:Number(r.position)})),
  }
}

export const onRequestGet = async ({env,request}:{env:Env;request:Request}) => {
  const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin']); if(auth instanceof Response)return auth
  const db=dbOr503(env); if(db instanceof Response)return db
  const rows=await db.prepare('SELECT * FROM academy_public_bundles WHERE tenant_id=? ORDER BY featured DESC,title').bind(auth.tenantId).all()
  const data=[]
  for(const row of rows.results as any[]) data.push({
    id:row.id,slug:row.slug,title:row.title,description:row.description??'',status:row.status,featured:Number(row.featured)===1,
    commercialMode:row.commercial_mode,listPriceCents:row.list_price_cents==null?null:Number(row.list_price_cents),currency:row.currency,
    coverRef:row.cover_ref??null,seoTitle:row.seo_title??null,seoDescription:row.seo_description??null,
    ...(await loadChildren(db,auth.tenantId,String(row.id))),createdAt:row.created_at,updatedAt:row.updated_at,
  })
  return json({data})
}

async function saveBundle(db:any,auth:any,body:Record<string,unknown>,existing?:any) {
  const id=existing?String(existing.id):crypto.randomUUID()
  const slug=publicSlug(body.slug??existing?.slug); const title=String(body.title??existing?.title??'').trim()
  const status=String(body.status??existing?.status??'hidden'); const commercialMode=String(body.commercialMode??existing?.commercial_mode??'contact_sales')
  const rawPrice=body.listPriceCents===undefined?existing?.list_price_cents:body.listPriceCents
  const listPriceCents=rawPrice==null||rawPrice===''?null:Number(rawPrice)
  const rawCover=String(body.coverRef??existing?.cover_ref??'').trim(); const coverRef=rawCover?safePublicAssetRef(rawCover):null
  const current=existing?await loadChildren(db,auth.tenantId,id):{courses:[],paths:[],plans:[],partners:[],externalItems:[]}
  const courseIds=body.courseIds===undefined?current.courses.map((x:any)=>x.id):uniqueIds(body.courseIds)
  const pathIds=body.pathIds===undefined?current.paths.map((x:any)=>x.id):uniqueIds(body.pathIds)
  const planIds=body.planIds===undefined?current.plans.map((x:any)=>x.id):uniqueIds(body.planIds)
  const partnerIds=body.partnerIds===undefined?current.partners.map((x:any)=>x.id):uniqueIds(body.partnerIds)
  const ext=body.externalItems===undefined?current.externalItems.map((x:any)=>({sourceSystem:x.sourceSystem,externalRef:x.externalRef,label:x.label,description:x.description,itemType:x.itemType})):externalItems(body.externalItems)
  if(!slug||!title||title.length>180||!STATUSES.has(status)||!COMMERCIAL_MODES.has(commercialMode)||!ext) return {error:'Dados do bundle inválidos',status:400}
  if(rawCover&&!coverRef)return {error:'coverRef inválido',status:400}
  if(commercialMode==='priced'&&(!Number.isInteger(listPriceCents)||Number(listPriceCents)<1))return {error:'Bundle pago exige preço positivo em centavos',status:400}
  if(commercialMode!=='priced'&&listPriceCents!=null)return {error:'Preço só é permitido em bundle pago',status:400}
  if(status==='public'&&!courseIds.length&&!pathIds.length&&!planIds.length&&!ext.length)return {error:'Bundle público exige ao menos um item',status:400}
  const refError=await validateRefs(db,auth.tenantId,{courseIds,pathIds,planIds,partnerIds},status==='public'); if(refError)return {error:refError,status:409}
  const now=new Date().toISOString()
  try{
    if(!existing) await db.prepare(`INSERT INTO academy_public_bundles (id,tenant_id,slug,title,description,status,featured,commercial_mode,list_price_cents,currency,cover_ref,seo_title,seo_description,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,'hidden',?,?,?,?,?,?,?,?,?,?,?)`).bind(id,auth.tenantId,slug,title,String(body.description??'').trim().slice(0,3000),body.featured===true?1:0,commercialMode,listPriceCents,String(body.currency??'BRL').trim().toUpperCase()||'BRL',coverRef,boundedText(body.seoTitle,160),boundedText(body.seoDescription,320),auth.userId,auth.userId,now,now).run()
    else await db.prepare("UPDATE academy_public_bundles SET status='hidden',updated_at=? WHERE tenant_id=? AND id=?").bind(now,auth.tenantId,id).run()
    for(const table of ['academy_public_bundle_courses','academy_public_bundle_paths','academy_public_bundle_plans','academy_public_bundle_partners','academy_public_bundle_external_items']) await db.prepare(`DELETE FROM ${table} WHERE tenant_id=? AND bundle_id=?`).bind(auth.tenantId,id).run()
    for(let i=0;i<courseIds.length;i++) await db.prepare('INSERT INTO academy_public_bundle_courses (id,tenant_id,bundle_id,course_id,position,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),auth.tenantId,id,courseIds[i],i,now).run()
    for(let i=0;i<pathIds.length;i++) await db.prepare('INSERT INTO academy_public_bundle_paths (id,tenant_id,bundle_id,path_id,position,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),auth.tenantId,id,pathIds[i],i,now).run()
    for(let i=0;i<planIds.length;i++) await db.prepare('INSERT INTO academy_public_bundle_plans (id,tenant_id,bundle_id,plan_id,position,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),auth.tenantId,id,planIds[i],i,now).run()
    for(let i=0;i<partnerIds.length;i++) await db.prepare('INSERT INTO academy_public_bundle_partners (id,tenant_id,bundle_id,partner_id,position,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),auth.tenantId,id,partnerIds[i],i,now).run()
    for(let i=0;i<ext.length;i++){const x=ext[i];await db.prepare('INSERT INTO academy_public_bundle_external_items (id,tenant_id,bundle_id,source_system,external_ref,label,description,item_type,position,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),auth.tenantId,id,x.sourceSystem,x.externalRef,x.label,x.description,x.itemType,i,now).run()}
    await db.prepare(`UPDATE academy_public_bundles SET slug=?,title=?,description=?,featured=?,commercial_mode=?,list_price_cents=?,currency=?,cover_ref=?,seo_title=?,seo_description=?,status=?,updated_by=?,updated_at=? WHERE tenant_id=? AND id=?`).bind(slug,title,String(body.description??existing?.description??'').trim().slice(0,3000),body.featured===undefined?Number(existing?.featured??0):body.featured===true?1:0,commercialMode,listPriceCents,String(body.currency??existing?.currency??'BRL').trim().toUpperCase()||'BRL',coverRef,boundedText(body.seoTitle??existing?.seo_title,160),boundedText(body.seoDescription??existing?.seo_description,320),status,auth.userId,now,auth.tenantId,id).run()
    await auditStatement(db,auth,{action:existing?'public_bundle.updated':'public_bundle.created',resourceType:'public_bundle',resourceId:id,metadata:{slug,status,commercialMode,courseCount:courseIds.length,pathCount:pathIds.length,planCount:planIds.length,partnerCount:partnerIds.length,externalCount:ext.length}}).run()
  }catch(error){return {error:error instanceof Error?error.message:'Não foi possível salvar bundle',status:409}}
  return {data:{id,slug,title,status,updatedAt:now},status:existing?200:201}
}

export const onRequestPost=async({env,request}:{env:Env;request:Request})=>{const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin']);if(auth instanceof Response)return auth;const db=dbOr503(env);if(db instanceof Response)return db;let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}const result=await saveBundle(db,auth,body);return json(result.error?{error:result.error}:{data:result.data},result.status)}
export const onRequestPut=async({env,request}:{env:Env;request:Request})=>{const auth=requireAdminContext(env,request,['academy_admin','ifarm_admin']);if(auth instanceof Response)return auth;const db=dbOr503(env);if(db instanceof Response)return db;let body:Record<string,unknown>;try{body=await bodyJson(request)}catch{return json({error:'JSON inválido'},400)}const bundleId=String(body.bundleId??'').trim();const existing=bundleId?await db.prepare('SELECT * FROM academy_public_bundles WHERE tenant_id=? AND id=?').bind(auth.tenantId,bundleId).first():null;if(!existing)return json({error:'Bundle não encontrado neste tenant'},404);const result=await saveBundle(db,auth,body,existing);return json(result.error?{error:result.error}:{data:result.data},result.status)}
