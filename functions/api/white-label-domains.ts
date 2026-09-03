import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { normalizeHostname } from './_whiteLabel'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const result = await db.prepare(`SELECT * FROM academy_white_label_domains WHERE tenant_id=? ORDER BY is_primary DESC,hostname`).bind(auth.tenantId).all()
  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id, hostname: row.hostname, status: row.status, isPrimary: Number(row.is_primary)===1,
    verificationReference: row.verification_reference ?? null, requestedAt: row.requested_at,
    verifiedAt: row.verified_at ?? null,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const hostname = normalizeHostname(String(body.hostname ?? ''))
  if (!hostname) return json({ error: 'Hostname inválido; informe somente o domínio, sem protocolo, porta ou caminho' }, 400)
  const occupied = await db.prepare('SELECT tenant_id,status FROM academy_white_label_domains WHERE hostname=? LIMIT 1').bind(hostname).first()
  if (occupied) return json({ error: 'Hostname já registrado na Academy' }, 409)
  const id = crypto.randomUUID(); const now = new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO academy_white_label_domains (id,tenant_id,hostname,status,is_primary,requested_by,requested_at,updated_at) VALUES (?,?,?,'pending',0,?,?,?)`).bind(id,auth.tenantId,hostname,auth.userId,now,now),
    auditStatement(db,auth,{ action:'white_label.domain_requested',resourceType:'white_label_domain',resourceId:id,metadata:{hostname} }),
  ])
  return json({ data:{ id,hostname,status:'pending',isPrimary:false,requestedAt:now } },201)
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const domainId = String(body.domainId ?? '').trim(); const action = String(body.action ?? '').trim()
  if (!domainId) return json({ error:'domainId é obrigatório' },400)
  const row = await db.prepare('SELECT * FROM academy_white_label_domains WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId,domainId).first()
  if (!row) return json({ error:'Domínio não encontrado neste tenant' },404)
  const now = new Date().toISOString()

  if (action === 'verify') {
    const reference = String(body.verificationReference ?? '').trim()
    if (!reference) return json({ error:'verificationReference é obrigatória; a Academy não verifica DNS automaticamente nesta versão' },400)
    const makePrimary = body.makePrimary === true
    const statements:any[] = []
    if (makePrimary) statements.push(db.prepare(`UPDATE academy_white_label_domains SET is_primary=0,updated_at=? WHERE tenant_id=? AND id!=?`).bind(now,auth.tenantId,domainId))
    statements.push(db.prepare(`UPDATE academy_white_label_domains SET status='verified',is_primary=?,verification_reference=?,verified_by=?,verified_at=?,updated_at=? WHERE tenant_id=? AND id=?`).bind(makePrimary?1:0,reference,auth.userId,now,now,auth.tenantId,domainId))
    statements.push(auditStatement(db,auth,{ action:'white_label.domain_verified',resourceType:'white_label_domain',resourceId:domainId,metadata:{hostname:row.hostname,makePrimary,verificationReferenceRecorded:true} }))
    await db.batch(statements)
    return json({ data:{ id:domainId,hostname:row.hostname,status:'verified',isPrimary:makePrimary,verifiedAt:now } })
  }

  if (action === 'set_primary') {
    if (String(row.status) !== 'verified') return json({ error:'Somente domínio verificado pode ser primário' },409)
    await db.batch([
      db.prepare(`UPDATE academy_white_label_domains SET is_primary=0,updated_at=? WHERE tenant_id=?`).bind(now,auth.tenantId),
      db.prepare(`UPDATE academy_white_label_domains SET is_primary=1,updated_at=? WHERE tenant_id=? AND id=?`).bind(now,auth.tenantId,domainId),
      auditStatement(db,auth,{ action:'white_label.domain_primary_changed',resourceType:'white_label_domain',resourceId:domainId,metadata:{hostname:row.hostname} }),
    ])
    return json({ data:{ id:domainId,hostname:row.hostname,status:'verified',isPrimary:true } })
  }

  if (action === 'disable') {
    await db.batch([
      db.prepare(`UPDATE academy_white_label_domains SET status='disabled',is_primary=0,updated_at=? WHERE tenant_id=? AND id=?`).bind(now,auth.tenantId,domainId),
      auditStatement(db,auth,{ action:'white_label.domain_disabled',resourceType:'white_label_domain',resourceId:domainId,metadata:{hostname:row.hostname} }),
    ])
    return json({ data:{ id:domainId,hostname:row.hostname,status:'disabled',isPrimary:false } })
  }

  return json({ error:'action inválida' },400)
}
