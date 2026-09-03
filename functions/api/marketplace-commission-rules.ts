import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { validateCommissionRule, type CommissionMode, type GatewayFeeResponsibility } from './_marketplace'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const submissionId = new URL(request.url).searchParams.get('submissionId')?.trim() ?? ''
  if (!submissionId) return json({ error: 'submissionId é obrigatório' }, 400)

  const submission = await db.prepare('SELECT id FROM academy_marketplace_submissions WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, submissionId).first()
  if (!submission) return json({ error: 'Submissão não encontrada neste tenant' }, 404)

  const result = await db.prepare(`
    SELECT * FROM academy_marketplace_commission_rules
    WHERE tenant_id=? AND submission_id=?
    ORDER BY version DESC
  `).bind(auth.tenantId, submissionId).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id,
    submissionId: row.submission_id,
    version: Number(row.version),
    status: row.status,
    calculationMode: row.calculation_mode,
    ifarmShareValue: Number(row.ifarm_share_value),
    instructorShareValue: Number(row.instructor_share_value),
    partnerShareValue: Number(row.partner_share_value),
    currency: row.currency,
    gatewayFeeResponsibility: row.gateway_fee_responsibility,
    validFrom: row.valid_from,
    validUntil: row.valid_until ?? null,
    rationale: row.rationale,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const submissionId = String(body.submissionId ?? '').trim()
  if (!submissionId) return json({ error: 'submissionId é obrigatório' }, 400)

  const submission = await db.prepare('SELECT * FROM academy_marketplace_submissions WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, submissionId).first()
  if (!submission) return json({ error: 'Submissão não encontrada neste tenant' }, 404)
  if (!['approved', 'published'].includes(String(submission.status))) {
    return json({ error: 'Regra de comissão só pode ser ativada após aprovação da submissão' }, 409)
  }

  const calculationMode = String(body.calculationMode ?? '') as CommissionMode
  const ifarmShareValue = Number(body.ifarmShareValue)
  const instructorShareValue = Number(body.instructorShareValue)
  const partnerShareValue = Number(body.partnerShareValue ?? 0)
  const gatewayFeeResponsibility = String(body.gatewayFeeResponsibility ?? '') as GatewayFeeResponsibility
  const validFromRaw = String(body.validFrom ?? '').trim()
  const validUntilRaw = body.validUntil == null || String(body.validUntil).trim() === '' ? null : String(body.validUntil).trim()
  const rationale = String(body.rationale ?? '').trim()
  const confirmed = body.confirmed === true

  const errors = validateCommissionRule({
    calculationMode, ifarmShareValue, instructorShareValue, partnerShareValue,
    gatewayFeeResponsibility, validFrom: validFromRaw, validUntil: validUntilRaw,
    rationale, confirmed,
  })
  if (errors.length) return json({ error: 'Regra de comissão inválida', details: errors }, 400)

  const validFrom = new Date(validFromRaw).toISOString()
  const validUntil = validUntilRaw ? new Date(validUntilRaw).toISOString() : null
  const now = new Date()
  if (new Date(validFrom).getTime() > now.getTime()) {
    return json({ error: 'Nesta versão, regra ativa precisa iniciar imediatamente ou no passado; agendamento futuro ainda não é suportado' }, 400)
  }

  const currency = String(body.currency ?? 'BRL').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) return json({ error: 'currency deve usar código ISO de 3 letras' }, 400)

  const versionRow = await db.prepare(`
    SELECT COALESCE(MAX(version),0) AS version
    FROM academy_marketplace_commission_rules
    WHERE tenant_id=? AND submission_id=?
  `).bind(auth.tenantId, submissionId).first()
  const version = Number(versionRow?.version ?? 0) + 1
  const id = crypto.randomUUID()
  const createdAt = now.toISOString()

  await db.batch([
    db.prepare(`UPDATE academy_marketplace_commission_rules SET status='retired' WHERE tenant_id=? AND submission_id=? AND status='active'`)
      .bind(auth.tenantId, submissionId),
    db.prepare(`
      INSERT INTO academy_marketplace_commission_rules (
        id,tenant_id,submission_id,version,status,calculation_mode,
        ifarm_share_value,instructor_share_value,partner_share_value,currency,
        gateway_fee_responsibility,valid_from,valid_until,rationale,
        confirmed_by,confirmed_at,created_at
      ) VALUES (?,?,?,?, 'active', ?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, auth.tenantId, submissionId, version, calculationMode,
      ifarmShareValue, instructorShareValue, partnerShareValue, currency,
      gatewayFeeResponsibility, validFrom, validUntil, rationale,
      auth.userId, createdAt, createdAt,
    ),
    auditStatement(db, auth, {
      action: 'marketplace.commission_rule_activated',
      resourceType: 'marketplace_submission',
      resourceId: submissionId,
      metadata: { version, calculationMode, gatewayFeeResponsibility, validFrom, validUntil, sharesExplicitlyConfigured: true },
    }),
  ])

  return json({ data: {
    id, submissionId, version, status: 'active', calculationMode,
    ifarmShareValue, instructorShareValue, partnerShareValue, currency,
    gatewayFeeResponsibility, validFrom, validUntil, rationale,
    confirmedBy: auth.userId, confirmedAt: createdAt,
  } }, 201)
}
