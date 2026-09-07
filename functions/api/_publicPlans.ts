export async function loadPublicPlans(db: any, tenantId: string, slug?: string | null) {
  const planResult = await db.prepare(`SELECT * FROM academy_plans
    WHERE tenant_id=? AND status='public' AND (? IS NULL OR slug=?)
    ORDER BY featured DESC,name`).bind(tenantId, slug ?? null, slug ?? null).all()
  const plans = planResult.results as any[]
  if (!plans.length) return []

  const [pricesResult, coursesResult, pathsResult, benefitsResult] = await Promise.all([
    db.prepare(`SELECT * FROM academy_plan_prices
      WHERE tenant_id=? AND status='active'
        AND (valid_from IS NULL OR datetime(valid_from)<=datetime('now'))
        AND (valid_until IS NULL OR datetime(valid_until)>datetime('now'))
      ORDER BY plan_id,billing_interval,version DESC`).bind(tenantId).all(),
    db.prepare(`SELECT pc.plan_id,c.id AS course_id,c.title,cp.slug,cp.category,cp.cover_ref
      FROM academy_plan_courses pc
      JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id AND c.status='published'
      JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id AND cp.visibility='public'
      LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=pc.tenant_id AND ws.status='active'
      LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=pc.tenant_id AND wc.course_id=pc.course_id AND wc.visible=1
      WHERE pc.tenant_id=?
        AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
      ORDER BY pc.plan_id,c.title`).bind(tenantId).all(),
    db.prepare(`SELECT pp.plan_id,p.id AS path_id,p.slug,p.title,p.short_description,p.cover_ref
      FROM academy_plan_paths pp
      JOIN academy_public_learning_paths p ON p.tenant_id=pp.tenant_id AND p.id=pp.path_id AND p.visibility='public'
      WHERE pp.tenant_id=? AND EXISTS (
        SELECT 1
        FROM academy_public_learning_path_courses plc
        JOIN academy_courses c ON c.tenant_id=plc.tenant_id AND c.id=plc.course_id AND c.status='published'
        JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id AND cp.visibility='public'
        LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=plc.tenant_id AND ws.status='active'
        LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=plc.tenant_id AND wc.course_id=plc.course_id AND wc.visible=1
        WHERE plc.tenant_id=pp.tenant_id AND plc.path_id=pp.path_id
          AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
      ) ORDER BY pp.plan_id,p.title`).bind(tenantId).all(),
    db.prepare(`SELECT plan_id,source_system,label,description FROM academy_plan_external_benefits
      WHERE tenant_id=? ORDER BY plan_id,source_system,label`).bind(tenantId).all(),
  ])

  const prices = pricesResult.results as any[]
  const courses = coursesResult.results as any[]
  const paths = pathsResult.results as any[]
  const benefits = benefitsResult.results as any[]

  return plans.map((row) => ({
    id: row.id, slug: row.slug, name: row.name, description: row.description ?? '',
    audienceType: row.audience_type, commercialMode: row.commercial_mode,
    featured: Number(row.featured) === 1, maxUsers: row.max_users == null ? null : Number(row.max_users),
    seoTitle: row.seo_title ?? null, seoDescription: row.seo_description ?? null,
    prices: prices.filter((price) => price.plan_id === row.id).map((price) => ({
      id: price.id, billingInterval: price.billing_interval, priceUnit: price.price_unit,
      version: Number(price.version), amountCents: Number(price.amount_cents), currency: price.currency,
      validFrom: price.valid_from ?? null, validUntil: price.valid_until ?? null,
    })),
    courses: courses.filter((item) => item.plan_id === row.id).map((item) => ({
      id: item.course_id, slug: item.slug, title: item.title, category: item.category ?? null, coverRef: item.cover_ref ?? null,
    })),
    paths: paths.filter((item) => item.plan_id === row.id).map((item) => ({
      id: item.path_id, slug: item.slug, title: item.title, shortDescription: item.short_description ?? null, coverRef: item.cover_ref ?? null,
    })),
    externalBenefits: benefits.filter((item) => item.plan_id === row.id).map((item) => ({
      sourceSystem: item.source_system, label: item.label, description: item.description ?? '',
    })),
    checkoutReady: false,
    subscriptionCreationReady: false,
  }))
}
