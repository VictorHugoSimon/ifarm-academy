import { requireAdminContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

const allowedRoles = ['academy_admin', 'ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const now = new Date()
  const nowIso = now.toISOString()
  const future30Iso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const summary = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='revoked' THEN 1 ELSE 0 END) AS revoked,
      SUM(CASE WHEN status='valid' AND valid_until IS NOT NULL AND valid_until<? THEN 1 ELSE 0 END) AS expired,
      SUM(CASE WHEN status='valid' AND valid_until>=? AND valid_until<=? THEN 1 ELSE 0 END) AS expiring_30_days,
      SUM(CASE WHEN validity_mode='not_configured' THEN 1 ELSE 0 END) AS without_policy,
      SUM(CASE WHEN validity_mode='fixed_months' THEN 1 ELSE 0 END) AS fixed_months,
      SUM(CASE WHEN validity_mode='indefinite' THEN 1 ELSE 0 END) AS indefinite
    FROM academy_certificates
    WHERE tenant_id=? AND certificate_type='regulatory_training'
  `).bind(nowIso, nowIso, future30Iso, auth.tenantId).first()

  const expiring = await db.prepare(`
    SELECT public_code, student_name, course_title, completion_date,
           issued_at, valid_until, validity_policy_version
    FROM academy_certificates
    WHERE tenant_id=? AND certificate_type='regulatory_training'
      AND status='valid' AND valid_until>=? AND valid_until<=?
    ORDER BY valid_until ASC
    LIMIT 50
  `).bind(auth.tenantId, nowIso, future30Iso).all()

  const missingPolicy = await db.prepare(`
    SELECT public_code, student_name, course_title, completion_date, issued_at
    FROM academy_certificates
    WHERE tenant_id=? AND certificate_type='regulatory_training'
      AND validity_mode='not_configured'
    ORDER BY issued_at DESC
    LIMIT 50
  `).bind(auth.tenantId).all()

  const number = (value: unknown) => {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return json({
    generatedAt: nowIso,
    kpis: {
      regulatoryCertificates: number(summary?.total),
      expired: number(summary?.expired),
      expiringIn30Days: number(summary?.expiring_30_days),
      revoked: number(summary?.revoked),
      withoutValidityPolicySnapshot: number(summary?.without_policy),
      fixedMonthsPolicySnapshot: number(summary?.fixed_months),
      indefinitePolicySnapshot: number(summary?.indefinite),
    },
    expiring: (expiring.results as any[]).map((row) => ({
      publicCode: row.public_code,
      studentName: row.student_name,
      courseTitle: row.course_title,
      completionDate: row.completion_date,
      issuedAt: row.issued_at,
      validUntil: row.valid_until,
      validityPolicyVersion: row.validity_policy_version == null ? null : Number(row.validity_policy_version),
    })),
    missingPolicy: (missingPolicy.results as any[]).map((row) => ({
      publicCode: row.public_code,
      studentName: row.student_name,
      courseTitle: row.course_title,
      completionDate: row.completion_date,
      issuedAt: row.issued_at,
    })),
    disclaimer: 'A situação temporal exibida usa apenas o snapshot explícito armazenado no certificado. Ausência de política não equivale a validade regulatória indefinida.',
  })
}
