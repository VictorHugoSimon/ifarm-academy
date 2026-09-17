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
      bp.period_start_source AS billing_period_start_source,
      bp.period_end_source AS billing_period_end_source,
      bp.provider_reported_period_start,bp.provider_reported_period_end,bp.provider_period_end_matches,
      bp.derived_at AS billing_period_derived_at,bp.derivation_version AS billing_period_derivation_version
    FROM academy_subscriptions s
    JOIN academy_plans p ON p.tenant_id=s.tenant_id AND p.id=s.plan_id
    LEFT JOIN academy_plan_prices pp ON pp.tenant_id=s.tenant_id AND pp.id=s.price_id
    LEFT JOIN academy_subscription_billing_periods bp ON bp.id=(
      SELECT bp2.id FROM academy_subscription_billing_periods bp2
      WHERE bp2.tenant_id=s.tenant_id AND bp2.subscription_id=s.id
      ORDER BY datetime(bp2.period_start) DESC,datetime(bp2.derived_at) DESC LIMIT 1
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
      billingPeriodEvidence: row.billing_period_end_source ? {
        startSource: row.billing_period_start_source,
        endSource: row.billing_period_end_source,
        providerReportedPeriodStart: row.provider_reported_period_start ?? null,
        providerReportedPeriodEnd: row.provider_reported_period_end ?? null,
        providerPeriodEndMatches: row.provider_period_end_matches == null ? null : Boolean(row.provider_period_end_matches),
        derivationVersion: Number(row.billing_period_derivation_version),
        derivedAt: row.billing_period_derived_at,
        disclosure: 'Período calculado pela Academy a partir da evidência canônica do pagamento e da periodicidade comercial imutável do checkout.',
      } : null,
      cancelledAt: row.cancelled_at ?? null, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    writeEnabled: false,
    note: 'Assinaturas pagas são ativadas apenas por evento verificado. O fim do período é derivado pela Academy da evidência canônica de pagamento + cadência comercial imutável; não é apresentado como period_end fornecido pelo provider.',
  })
}
