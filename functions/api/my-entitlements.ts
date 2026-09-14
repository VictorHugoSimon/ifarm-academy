import { requireTrustedContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const result = await db.prepare(`SELECT e.*,p.name AS plan_name,p.slug AS plan_slug,p.commercial_mode
    FROM academy_entitlements e
    JOIN academy_plans p ON p.tenant_id=e.tenant_id AND p.id=e.plan_id
    WHERE e.tenant_id=? AND e.user_id=?
    ORDER BY e.updated_at DESC`).bind(auth.tenantId, auth.userId).all()
  return json({
    data: (result.results as any[]).map((row) => ({
      id: row.id, planId: row.plan_id, planName: row.plan_name, planSlug: row.plan_slug,
      commercialMode: row.commercial_mode, sourceType: row.source_type, sourceId: row.source_id,
      status: row.status, startsAt: row.starts_at ?? null, endsAt: row.ends_at ?? null,
      activationEvidenceType: row.activation_evidence_type ?? null,
      activationReference: row.activation_reference ?? null,
      createdAt: row.created_at, updatedAt: row.updated_at,
    })),
  })
}
