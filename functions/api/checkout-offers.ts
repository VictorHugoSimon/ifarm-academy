import { requireTrustedContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const courses = await db.prepare(`
    SELECT c.id, c.title, p.list_price_cents, p.currency
    FROM academy_course_public_profiles p
    JOIN academy_courses c ON c.id=p.course_id AND c.tenant_id=p.tenant_id
    LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=p.tenant_id AND ws.status='active'
    LEFT JOIN academy_white_label_catalog_courses wc
      ON wc.tenant_id=p.tenant_id AND wc.course_id=p.course_id AND wc.visible=1
    WHERE p.tenant_id=? AND p.visibility='public' AND p.access_model='paid'
      AND p.list_price_cents>0 AND c.status='published'
      AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM academy_enrollments e
        WHERE e.tenant_id=p.tenant_id AND e.student_id=? AND e.course_id=p.course_id
          AND e.status IN ('active','completed')
      )
    ORDER BY c.title
  `).bind(auth.tenantId, auth.userId).all()

  const plans = await db.prepare(`
    SELECT p.id, p.name, p.description, p.audience_type, p.max_users,
           pp.id AS price_id, pp.billing_interval, pp.price_unit, pp.amount_cents, pp.currency
    FROM academy_plans p
    JOIN academy_plan_prices pp ON pp.plan_id=p.id AND pp.tenant_id=p.tenant_id
    WHERE p.tenant_id=? AND p.status='public' AND p.commercial_mode='priced'
      AND pp.status='active'
      AND (pp.valid_from IS NULL OR datetime(pp.valid_from)<=datetime('now'))
      AND (pp.valid_until IS NULL OR datetime(pp.valid_until)>datetime('now'))
      AND NOT EXISTS (
        SELECT 1 FROM academy_subscriptions s
        WHERE s.tenant_id=p.tenant_id AND s.user_id=? AND s.plan_id=p.id
          AND s.status IN ('active','past_due')
      )
    ORDER BY p.name, pp.billing_interval
  `).bind(auth.tenantId, auth.userId).all()

  const events = await db.prepare(`
    SELECT e.id, e.title, e.description, e.starts_at, e.timezone, e.capacity,
           e.price_cents, e.currency,
           (SELECT COUNT(*) FROM academy_event_registrations r
              WHERE r.tenant_id=e.tenant_id AND r.event_id=e.id
                AND r.status IN ('registered','attended')) AS occupied
    FROM academy_events e
    WHERE e.tenant_id=? AND e.status='published' AND e.access_model='paid'
      AND e.price_cents>0 AND datetime(e.starts_at)>datetime('now')
      AND (e.registration_deadline IS NULL OR datetime(e.registration_deadline)>datetime('now'))
      AND NOT EXISTS (
        SELECT 1 FROM academy_event_registrations r
        WHERE r.tenant_id=e.tenant_id AND r.user_id=? AND r.event_id=e.id
          AND r.status NOT IN ('cancelled','no_show')
      )
      AND (e.capacity IS NULL OR (
        SELECT COUNT(*) FROM academy_event_registrations r2
        WHERE r2.tenant_id=e.tenant_id AND r2.event_id=e.id
          AND r2.status IN ('registered','attended')
      ) < e.capacity)
    ORDER BY e.starts_at
  `).bind(auth.tenantId, auth.userId).all()

  return json({
    data: {
      courses: (courses.results as any[]).map((row) => ({
        productType: 'course' as const,
        productId: String(row.id),
        title: String(row.title),
        amountCents: Number(row.list_price_cents),
        currency: String(row.currency),
        quantityMode: 'fixed_one' as const,
      })),
      plans: (plans.results as any[]).map((row) => ({
        productType: 'plan' as const,
        productId: String(row.id),
        title: String(row.name),
        description: String(row.description ?? ''),
        audienceType: String(row.audience_type),
        billingInterval: String(row.billing_interval),
        priceUnit: String(row.price_unit),
        amountCents: Number(row.amount_cents),
        currency: String(row.currency),
        maxUsers: row.max_users == null ? null : Number(row.max_users),
        quantityMode: String(row.price_unit) === 'per_user' ? 'per_user' as const : 'fixed_one' as const,
      })),
      events: (events.results as any[]).map((row) => ({
        productType: 'event' as const,
        productId: String(row.id),
        title: String(row.title),
        description: String(row.description ?? ''),
        startsAt: String(row.starts_at),
        timezone: String(row.timezone),
        capacity: row.capacity == null ? null : Number(row.capacity),
        occupied: Number(row.occupied ?? 0),
        amountCents: Number(row.price_cents),
        currency: String(row.currency),
        quantityMode: 'fixed_one' as const,
      })),
      paymentAdapter: {
        available: false,
        provider: null,
        message: 'Pagamento externo ainda não habilitado. A Academy pode criar apenas o pedido com snapshot de preço.',
      },
    },
  })
}
