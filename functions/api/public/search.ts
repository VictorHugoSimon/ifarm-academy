import { parsePublicSearchFilters, searchPublicCandidates, type PublicSearchCandidate } from '../_publicSearch'
import { resolvePublicTenant } from '../_publicTenant'
import { dbOr503, json, safeJson, type Env } from '../_shared'

const CANDIDATE_LIMIT = 250

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const db = dbOr503(env); if (db instanceof Response) return db
  const context = await resolvePublicTenant(db, env, request)
  if (!context) return json({ error: 'Portal público não configurado para este host' }, 404)

  const filters = parsePublicSearchFilters(new URL(request.url))

  const [courseRows, pathRows, instructorRows, eventRows, planRows] = await Promise.all([
    db.prepare(`
      SELECT c.id,c.title,c.description,c.instructor_label,c.certificate_type,
        p.slug,p.category,p.level_label,p.short_description,p.audience_text,p.cover_ref,
        p.access_model,p.featured,COALESCE(wc.featured,0) AS white_label_featured
      FROM academy_course_public_profiles p
      JOIN academy_courses c ON c.id=p.course_id AND c.tenant_id=p.tenant_id AND c.status='published'
      LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
      LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
      WHERE p.tenant_id=? AND p.visibility='public'
        AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
      ORDER BY CASE WHEN (p.featured=1 OR COALESCE(wc.featured,0)=1) THEN 0 ELSE 1 END,c.title
      LIMIT ${CANDIDATE_LIMIT}
    `).bind(context.tenantId).all(),
    db.prepare(`
      SELECT p.*
      FROM academy_public_learning_paths p
      WHERE p.tenant_id=? AND p.visibility='public'
        AND EXISTS (
          SELECT 1 FROM academy_public_learning_path_courses pc
          JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id AND c.status='published'
          JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id AND cp.visibility='public'
          LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=pc.tenant_id AND ws.status='active'
          LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=pc.tenant_id AND wc.course_id=pc.course_id AND wc.visible=1
          WHERE pc.tenant_id=p.tenant_id AND pc.path_id=p.id
            AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
        )
      ORDER BY p.featured DESC,p.title
      LIMIT ${CANDIDATE_LIMIT}
    `).bind(context.tenantId).all(),
    db.prepare(`
      SELECT p.*,i.display_name_snapshot
      FROM academy_instructor_public_profiles p
      JOIN academy_instructors i ON i.id=p.instructor_id AND i.tenant_id=p.tenant_id AND i.status='active'
      WHERE p.tenant_id=? AND p.visibility='public'
      ORDER BY p.featured DESC,i.display_name_snapshot
      LIMIT ${CANDIDATE_LIMIT}
    `).bind(context.tenantId).all(),
    db.prepare(`
      SELECT e.*
      FROM academy_events e
      WHERE e.tenant_id=? AND e.status='published' AND datetime(e.ends_at)>=datetime('now')
      ORDER BY e.starts_at ASC
      LIMIT ${CANDIDATE_LIMIT}
    `).bind(context.tenantId).all(),
    db.prepare(`
      SELECT p.*,
        (SELECT GROUP_CONCAT(b.label,' ') FROM academy_plan_external_benefits b
          WHERE b.tenant_id=p.tenant_id AND b.plan_id=p.id) AS benefit_labels
      FROM academy_plans p
      WHERE p.tenant_id=? AND p.status='public'
      ORDER BY p.featured DESC,p.name
      LIMIT ${CANDIDATE_LIMIT}
    `).bind(context.tenantId).all(),
  ])

  const candidates: PublicSearchCandidate[] = []

  for (const row of courseRows.results as any[]) {
    candidates.push({
      type: 'course', id: String(row.id), slug: row.slug, title: String(row.title),
      description: String(row.short_description || row.description || ''), category: row.category ?? null,
      level: row.level_label ?? null, accessModel: row.access_model ?? null, modality: null,
      imageRef: row.cover_ref ?? null, featured: Number(row.featured) === 1 || Number(row.white_label_featured) === 1,
      href: `/courses/${row.slug}`,
      meta: [row.instructor_label, row.audience_text, row.certificate_type].filter((value): value is string => typeof value === 'string' && value.length > 0),
    })
  }

  for (const row of pathRows.results as any[]) {
    candidates.push({
      type: 'path', id: String(row.id), slug: row.slug, title: String(row.title),
      description: String(row.short_description || row.description || ''), category: row.category ?? null,
      level: null, accessModel: row.access_model ?? null, modality: null, imageRef: row.cover_ref ?? null,
      featured: Number(row.featured) === 1, href: `/paths/${row.slug}`,
    })
  }

  for (const row of instructorRows.results as any[]) {
    const specialties = safeJson(row.public_specialties_json, [])
    candidates.push({
      type: 'instructor', id: String(row.instructor_id), slug: row.slug,
      title: String(row.display_name_snapshot), description: String(row.headline || row.short_bio || ''),
      category: null, level: null, accessModel: null, modality: null, imageRef: row.photo_ref ?? null,
      featured: Number(row.featured) === 1, href: `/instructors/${row.slug}`,
      meta: [
        ...(Array.isArray(specialties) ? specialties.filter((value): value is string => typeof value === 'string') : []),
        row.credential_summary,
      ].filter((value): value is string => typeof value === 'string' && value.length > 0),
    })
  }

  for (const row of eventRows.results as any[]) {
    candidates.push({
      type: 'event', id: String(row.id), slug: null, title: String(row.title),
      description: String(row.description || ''), category: row.event_type ?? null, level: null,
      accessModel: row.access_model ?? null, modality: row.modality ?? null, startsAt: row.starts_at ?? null,
      imageRef: null, featured: false, href: '/events',
      meta: [row.venue_name, row.address_text, Number(row.smart_farm_experience) === 1 ? 'Smart Farm Experience' : null]
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    })
  }

  for (const row of planRows.results as any[]) {
    const accessModel = row.commercial_mode === 'free' ? 'free' : row.commercial_mode === 'priced' ? 'paid' : 'contact_sales'
    candidates.push({
      type: 'plan', id: String(row.id), slug: row.slug, title: String(row.name),
      description: String(row.description || ''), category: row.audience_type ?? null, level: null,
      accessModel, modality: null, imageRef: null, featured: Number(row.featured) === 1,
      href: `/plans/${row.slug}`,
      meta: [row.benefit_labels].filter((value): value is string => typeof value === 'string' && value.length > 0),
    })
  }

  const result = searchPublicCandidates(candidates, filters)
  return json({
    brand: context.brand,
    query: filters.query,
    filters: {
      types: filters.types,
      category: filters.category || null,
      access: filters.access || null,
      level: filters.level || null,
      modality: filters.modality || null,
    },
    data: result.items.map(({ searchText: _searchText, ...item }) => item),
    facets: result.facets,
    pagination: { ...result.pagination, total: result.total },
    ranking: { behavioralPersonalization: false, commercialProfiling: false, strategy: 'text_match_plus_editorial_featured' },
  })
}
