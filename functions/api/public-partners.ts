import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { boundedText, publicSlug, safePublicAssetRef } from './_publicDiscovery'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const PARTNER_TYPES = new Set(['technology','education','financial','insurance','retail','service','sponsor','other'])
const STATUSES = new Set(['hidden','public'])

function safeHttpsUrl(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.toString()
  } catch { return null }
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const rows = await db.prepare(`SELECT * FROM academy_public_partners WHERE tenant_id=? ORDER BY featured DESC,display_name`).bind(auth.tenantId).all()
  return json({ data: (rows.results as any[]).map((row) => ({
    id: row.id, slug: row.slug, displayName: row.display_name, description: row.description ?? '',
    partnerType: row.partner_type, sourceSystem: row.source_system, externalRef: row.external_ref,
    logoRef: row.logo_ref ?? null, websiteUrl: row.website_url ?? null, status: row.status,
    featured: Number(row.featured) === 1, createdAt: row.created_at, updatedAt: row.updated_at,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>; try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const slug = publicSlug(body.slug)
  const displayName = String(body.displayName ?? '').trim()
  const sourceSystem = String(body.sourceSystem ?? '').trim().slice(0,80)
  const externalRef = String(body.externalRef ?? '').trim().slice(0,180)
  const partnerType = String(body.partnerType ?? 'technology').trim()
  const status = String(body.status ?? 'hidden').trim()
  const rawLogo = String(body.logoRef ?? '').trim(); const logoRef = rawLogo ? safePublicAssetRef(rawLogo) : null
  const rawWebsite = String(body.websiteUrl ?? '').trim(); const websiteUrl = rawWebsite ? safeHttpsUrl(rawWebsite) : null
  if (!slug || !displayName || displayName.length > 160 || !sourceSystem || !externalRef) return json({ error: 'slug, displayName, sourceSystem e externalRef são obrigatórios' }, 400)
  if (!PARTNER_TYPES.has(partnerType) || !STATUSES.has(status)) return json({ error: 'partnerType/status inválido' }, 400)
  if (rawLogo && !logoRef) return json({ error: 'logoRef inválido' }, 400)
  if (rawWebsite && !websiteUrl) return json({ error: 'websiteUrl deve usar HTTPS' }, 400)
  const id = crypto.randomUUID(); const now = new Date().toISOString()
  try {
    await db.prepare(`INSERT INTO academy_public_partners (id,tenant_id,slug,display_name,description,partner_type,source_system,external_ref,logo_ref,website_url,status,featured,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?)`)
      .bind(id,auth.tenantId,slug,displayName,String(body.description ?? '').trim().slice(0,2000),partnerType,sourceSystem,externalRef,logoRef,websiteUrl,status,body.featured===true?1:0,auth.userId,auth.userId,now,now).run()
    await auditStatement(db, auth, { action:'public_partner.created', resourceType:'public_partner', resourceId:id, metadata:{ slug,status,partnerType,sourceSystem } }).run()
  } catch (error) { return json({ error:error instanceof Error?error.message:'Não foi possível criar parceiro' },409) }
  return json({ data:{ id,slug,displayName,status,updatedAt:now } },201)
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>; try { body = await bodyJson(request) } catch { return json({ error:'JSON inválido' },400) }
  const partnerId = String(body.partnerId ?? '').trim()
  const existing = partnerId ? await db.prepare('SELECT * FROM academy_public_partners WHERE tenant_id=? AND id=?').bind(auth.tenantId,partnerId).first() : null
  if (!existing) return json({ error:'Parceiro não encontrado neste tenant' },404)
  const slug = publicSlug(body.slug ?? existing.slug); const displayName = String(body.displayName ?? existing.display_name).trim()
  const partnerType = String(body.partnerType ?? existing.partner_type); const status = String(body.status ?? existing.status)
  const rawLogo = String(body.logoRef ?? existing.logo_ref ?? '').trim(); const logoRef = rawLogo?safePublicAssetRef(rawLogo):null
  const rawWebsite = String(body.websiteUrl ?? existing.website_url ?? '').trim(); const websiteUrl = rawWebsite?safeHttpsUrl(rawWebsite):null
  if (!slug || !displayName || displayName.length>160 || !PARTNER_TYPES.has(partnerType) || !STATUSES.has(status)) return json({ error:'Dados públicos inválidos' },400)
  if (rawLogo && !logoRef) return json({ error:'logoRef inválido' },400)
  if (rawWebsite && !websiteUrl) return json({ error:'websiteUrl deve usar HTTPS' },400)
  const now = new Date().toISOString()
  try {
    await db.prepare(`UPDATE academy_public_partners SET slug=?,display_name=?,description=?,partner_type=?,logo_ref=?,website_url=?,status=?,featured=?,updated_by=?,updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(slug,displayName,String(body.description ?? existing.description ?? '').trim().slice(0,2000),partnerType,logoRef,websiteUrl,status,body.featured===undefined?Number(existing.featured):body.featured===true?1:0,auth.userId,now,auth.tenantId,partnerId).run()
    await auditStatement(db, auth, { action:'public_partner.updated', resourceType:'public_partner', resourceId:partnerId, metadata:{ slug,status,partnerType } }).run()
  } catch (error) { return json({ error:error instanceof Error?error.message:'Não foi possível atualizar parceiro' },409) }
  return json({ data:{ id:partnerId,slug,displayName,status,updatedAt:now } })
}
