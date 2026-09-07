import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { boundedText, normalizePublicTextList, publicSlug, safePublicAssetRef } from './_publicDiscovery'
import { bodyJson, dbOr503, json, safeJson, type Env } from './_shared'

const VISIBILITIES = ['hidden','public']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const rows = await db.prepare(`
    SELECT i.id AS instructor_id,i.display_name_snapshot,i.status,
      p.slug,p.visibility,p.headline,p.short_bio,p.photo_ref,p.public_specialties_json,
      p.credential_summary,p.featured,p.seo_title,p.seo_description,p.updated_at
    FROM academy_instructors i
    LEFT JOIN academy_instructor_public_profiles p
      ON p.tenant_id=i.tenant_id AND p.instructor_id=i.id
    WHERE i.tenant_id=?
    ORDER BY COALESCE(p.featured,0) DESC,i.display_name_snapshot
  `).bind(auth.tenantId).all()

  return json({ data: (rows.results as any[]).map((row) => ({
    instructorId: row.instructor_id,
    displayName: row.display_name_snapshot,
    instructorStatus: row.status,
    configured: Boolean(row.slug),
    slug: row.slug ?? null,
    visibility: row.visibility ?? 'hidden',
    headline: row.headline ?? null,
    shortBio: row.short_bio ?? null,
    photoRef: row.photo_ref ?? null,
    specialties: safeJson(row.public_specialties_json, []),
    credentialSummary: row.credential_summary ?? null,
    featured: Number(row.featured ?? 0) === 1,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    updatedAt: row.updated_at ?? null,
  })) })
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const instructorId = String(body.instructorId ?? '').trim()
  const slug = publicSlug(body.slug)
  const visibility = String(body.visibility ?? 'hidden').trim()
  const headline = boundedText(body.headline, 140)
  const shortBio = boundedText(body.shortBio, 1000)
  const credentialSummary = boundedText(body.credentialSummary, 240)
  const specialties = normalizePublicTextList(body.specialties)
  const rawPhotoRef = String(body.photoRef ?? '').trim()
  const photoRef = rawPhotoRef ? safePublicAssetRef(rawPhotoRef) : null
  const seoTitle = boundedText(body.seoTitle, 160)
  const seoDescription = boundedText(body.seoDescription, 320)
  const featured = body.featured === true

  if (!instructorId || !slug) return json({ error: 'instructorId e slug válido são obrigatórios' }, 400)
  if (!VISIBILITIES.includes(visibility)) return json({ error: 'visibility inválida' }, 400)
  if (rawPhotoRef && !photoRef) return json({ error: 'photoRef deve ser HTTPS ou referência relativa segura' }, 400)
  if (String(body.headline ?? '').trim() && !headline) return json({ error: 'headline excede 140 caracteres' }, 400)
  if (String(body.shortBio ?? '').trim() && !shortBio) return json({ error: 'shortBio excede 1000 caracteres' }, 400)
  if (String(body.credentialSummary ?? '').trim() && !credentialSummary) return json({ error: 'credentialSummary excede 240 caracteres' }, 400)

  const instructor = await db.prepare('SELECT * FROM academy_instructors WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, instructorId).first()
  if (!instructor) return json({ error: 'Instrutor não encontrado neste tenant' }, 404)
  if (visibility === 'public' && String(instructor.status) !== 'active') return json({ error: 'Somente instrutor ativo pode ter perfil público' }, 409)

  const existing = await db.prepare('SELECT * FROM academy_instructor_public_profiles WHERE tenant_id=? AND instructor_id=? LIMIT 1')
    .bind(auth.tenantId, instructorId).first()
  const now = new Date().toISOString()
  const specialtiesJson = JSON.stringify(specialties)

  if (existing) {
    await db.batch([
      db.prepare(`UPDATE academy_instructor_public_profiles SET
        slug=?,visibility=?,headline=?,short_bio=?,photo_ref=?,public_specialties_json=?,credential_summary=?,
        featured=?,seo_title=?,seo_description=?,updated_at=?
        WHERE tenant_id=? AND instructor_id=?`)
        .bind(slug, visibility, headline, shortBio, photoRef, specialtiesJson, credentialSummary, featured ? 1 : 0, seoTitle, seoDescription, now, auth.tenantId, instructorId),
      auditStatement(db, auth, { action: 'instructor_public_profile.updated', resourceType: 'instructor_public_profile', resourceId: instructorId, metadata: { slug, visibility, featured, specialtyCount: specialties.length } }),
    ])
  } else {
    await db.batch([
      db.prepare(`INSERT INTO academy_instructor_public_profiles (
        instructor_id,tenant_id,slug,visibility,headline,short_bio,photo_ref,public_specialties_json,
        credential_summary,featured,seo_title,seo_description,created_by,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(instructorId, auth.tenantId, slug, visibility, headline, shortBio, photoRef, specialtiesJson, credentialSummary, featured ? 1 : 0, seoTitle, seoDescription, auth.userId, now, now),
      auditStatement(db, auth, { action: 'instructor_public_profile.created', resourceType: 'instructor_public_profile', resourceId: instructorId, metadata: { slug, visibility, featured, specialtyCount: specialties.length } }),
    ])
  }

  return json({ data: { instructorId, displayName: instructor.display_name_snapshot, slug, visibility, headline, shortBio, photoRef, specialties, credentialSummary, featured, seoTitle, seoDescription, updatedAt: now } })
}
