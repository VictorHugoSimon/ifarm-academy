import { requireTrustedContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const result = await db.prepare(`
    SELECT s.id AS submission_id, s.course_id, s.published_at,
      c.title, c.description,
      i.id AS instructor_id, i.display_name_snapshot AS instructor_name,
      r.id AS rule_id, r.version AS rule_version, r.calculation_mode,
      r.ifarm_share_value, r.instructor_share_value, r.partner_share_value,
      r.gateway_fee_responsibility, r.valid_from, r.valid_until
    FROM academy_marketplace_submissions s
    JOIN academy_courses c ON c.id=s.course_id AND c.tenant_id=s.tenant_id AND c.status='published'
    JOIN academy_instructors i ON i.id=s.submitter_instructor_id AND i.tenant_id=s.tenant_id AND i.status='active'
    JOIN academy_marketplace_commission_rules r
      ON r.tenant_id=s.tenant_id AND r.submission_id=s.id AND r.status='active'
    WHERE s.tenant_id=?
      AND s.status='published'
      AND datetime(r.valid_from) <= datetime('now')
      AND (r.valid_until IS NULL OR datetime(r.valid_until) > datetime('now'))
    ORDER BY s.published_at DESC, c.title
  `).bind(auth.tenantId).all()

  return json({ data: (result.results as any[]).map((row) => ({
    submissionId: row.submission_id,
    courseId: row.course_id,
    title: row.title,
    description: row.description ?? '',
    instructor: { id: row.instructor_id, name: row.instructor_name },
    publishedAt: row.published_at,
    commercialStatus: 'listed',
    checkoutReady: false,
    commissionRuleVersion: Number(row.rule_version),
  })) })
}
