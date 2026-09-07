import { requireAdminContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin','ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ADMIN_ROLES)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const status = new URL(request.url).searchParams.get('status')?.trim() ?? ''
  const result = await db.prepare(`SELECT s.*,p.name AS plan_name,p.commercial_mode,
      pp.billing_interval,pp.price_unit,pp.amount_cents,pp.currency,pp.version AS price_version
    FROM academy_subscriptions s
    JOIN academy_plans p ON p.tenant_id=s.tenant_id AND p.id=s.plan_id
    LEFT JOIN academy_plan_prices pp ON pp.tenant_id=s.tenant_id AND pp.id=s.price_id
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
      cancelledAt: row.cancelled_at ?? null, createdAt: row.created_at, updatedAt: row.updated_at,
    })),
    writeEnabled: false,
    note: 'v0.41 não cria nem ativa assinaturas; ativação será adicionada somente após integração de identidade/pagamento ou regra contratual homologada.',
  })
}
