import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { brandFromRow, validateBrandInput } from './_whiteLabel'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const row = await db.prepare('SELECT * FROM academy_white_label_settings WHERE tenant_id=? LIMIT 1').bind(auth.tenantId).first()
  return json({ data: brandFromRow(row), configured: Boolean(row) })
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const input = {
    brandName: String(body.brandName ?? '').trim(), academyName: String(body.academyName ?? '').trim(),
    primaryColor: String(body.primaryColor ?? '').trim(), secondaryColor: String(body.secondaryColor ?? '').trim(),
    accentColor: String(body.accentColor ?? '').trim(),
    logoRef: body.logoRef == null ? null : String(body.logoRef).trim() || null,
    certificateHeading: body.certificateHeading == null ? null : String(body.certificateHeading).trim() || null,
    catalogMode: String(body.catalogMode ?? '').trim(),
  }
  const errors = validateBrandInput(input)
  if (errors.length) return json({ error: 'Configuração inválida', details: errors }, 400)
  const now = new Date().toISOString()
  const exists = await db.prepare('SELECT 1 AS ok FROM academy_white_label_settings WHERE tenant_id=?').bind(auth.tenantId).first()

  const save = exists
    ? db.prepare(`UPDATE academy_white_label_settings SET brand_name=?,academy_name=?,primary_color=?,secondary_color=?,accent_color=?,logo_ref=?,certificate_heading=?,catalog_mode=?,status='active',updated_by=?,updated_at=? WHERE tenant_id=?`).bind(input.brandName,input.academyName,input.primaryColor,input.secondaryColor,input.accentColor,input.logoRef,input.certificateHeading,input.catalogMode,auth.userId,now,auth.tenantId)
    : db.prepare(`INSERT INTO academy_white_label_settings (tenant_id,brand_name,academy_name,primary_color,secondary_color,accent_color,logo_ref,certificate_heading,catalog_mode,status,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'active',?,?,?)`).bind(auth.tenantId,input.brandName,input.academyName,input.primaryColor,input.secondaryColor,input.accentColor,input.logoRef,input.certificateHeading,input.catalogMode,auth.userId,now,now)

  await db.batch([save, auditStatement(db, auth, { action: 'white_label.brand_saved', resourceType: 'white_label_settings', resourceId: auth.tenantId, metadata: { catalogMode: input.catalogMode } })])
  const row = await db.prepare('SELECT * FROM academy_white_label_settings WHERE tenant_id=?').bind(auth.tenantId).first()
  return json({ data: brandFromRow(row) })
}
