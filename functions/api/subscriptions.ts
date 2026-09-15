import { requireAdminContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin','ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const status = new URL(request.url).searchParams.get('status')?.trim() ?? ''
  const result = await db.prepare(`SELECT s.*,p.name AS plan_name,p.commercial_mode,
      pp.billing_interval,pp.price_unit,pp.amount_cents,pp.currency,pp.version AS price_version,
      be.evidence_status AS billing_evidence_status,be.provider_resource_type AS billing_resource_type,
      be.provider_resource_id AS billing_resource_id,be.period_start AS billing_period_start,
      be.period_end AS billing_period_end,be.observed_at AS billing_observed_at,be.payload_hash AS billing_payload_hash
    FROM academy_subscriptions s
    JOIN academy_plans p ON p.tenant_id=s.tenant_id AND p.id=s.plan_id
    LEFT JOIN academy_plan_prices pp ON pp.tenant_id=s.tenant_id AND pp.id=s.price_id
    LEFT JOIN academy_subscription_billing_period_evidence be ON be.id=(
      SELECT b.id FROM academy_subscription_billing_period_evidence b
      WHERE b.tenant_id=s.tenant_id AND b.subscription_id=s.id
      ORDER BY datetime(b.observed_at) DESC,b.created_at DESC LIMIT 1
    )
    WHERE s.tenant_id=? AND (?='' OR s.status=?)
    ORDER BY s.updated_at DESC`).bind(auth.tenantId, status, status).all()
  return json({
    data: (result.results as any[]).map((row) => ({
      id: row.id, userId: row.user_id, planId: row.plan_id, planName: row.plan_name,
      commercialMode: row.commercial_mode, priceId: row.price_id ?? null,
      price: row.price_id ? { billingInterval: row.billing_interval, priceUnit: row.price_unit, amountCents: Number(row.amount_cents), currency: row.currency, version: Number(row.price_version) } : null,
      status: row.status, provider: row.provider ?? null, providerSubscriptionId: row.provider_subscription_id ?? null,
      activationReference: row.activation_reference ?? null, startedAt: row.started_at ?? null,
      currentPeriodStart: row.current_period_start ?? null, currentPeriodEnd: row.current_period_end ?? null,
      billingPeriodEvidence: row.billing_evidence_status ? {
        status: row.billing_evidence_status,
        resourceType: row.billing_resource_type,
        resourceId: row.billing_resource_id,
        periodStart: row.billing_period_start ?? null,
        periodEnd: row.billing_period_end ?? null,
        observedAt: row.billing_observed_at,
        payloadHash: row.billing_payload_hash,
      } : null,
      cancelledAt: row.cancelled_at ?? null, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    writeEnabled: false,
    note: 'Período recorrente só é exibido quando existe evidência canônica do provider; datas ausentes não são inferidas pela Academy.',
  })
}
