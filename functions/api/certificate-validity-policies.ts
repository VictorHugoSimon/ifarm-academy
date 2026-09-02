import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { validateValidityPolicyInput } from './_certificateValidity'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const allowedRoles = ['academy_admin', 'ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const result = await db.prepare(`
    SELECT
      c.id AS course_id,
      c.title AS course_title,
      c.status AS course_status,
      c.certificate_type,
      p.id AS policy_id,
      p.validity_mode,
      p.validity_months,
      p.source_reference,
      p.note,
      p.version,
      p.confirmed_by,
      p.confirmed_at,
      p.updated_at
    FROM academy_courses c
    LEFT JOIN academy_certificate_validity_policies p
      ON p.tenant_id=c.tenant_id AND p.course_id=c.id
    WHERE c.tenant_id=? AND c.status!='archived'
    ORDER BY c.certificate_type='regulatory_training' DESC, c.title
  `).bind(auth.tenantId).all()

  return json({ data: (result.results as any[]).map((row) => ({
    courseId: row.course_id,
    courseTitle: row.course_title,
    courseStatus: row.course_status,
    certificateType: row.certificate_type,
    policyConfigured: Boolean(row.policy_id),
    policy: row.policy_id ? {
      id: row.policy_id,
      validityMode: row.validity_mode,
      validityMonths: row.validity_months == null ? null : Number(row.validity_months),
      sourceReference: row.source_reference,
      note: row.note,
      version: Number(row.version),
      confirmedBy: row.confirmed_by,
      confirmedAt: row.confirmed_at,
      updatedAt: row.updated_at,
    } : null,
  })) })
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const courseId = String(body.courseId ?? '').trim()
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const validated = validateValidityPolicyInput({
    mode: body.validityMode,
    validityMonths: body.validityMonths,
    sourceReference: body.sourceReference,
    note: body.note,
    confirmed: body.confirmed,
  })
  if (!validated.ok) return json({ error: validated.error }, 400)

  const course = await db.prepare(`
    SELECT id, title, certificate_type, status
    FROM academy_courses
    WHERE tenant_id=? AND id=? LIMIT 1
  `).bind(auth.tenantId, courseId).first()
  if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)

  const existing = await db.prepare(`
    SELECT * FROM academy_certificate_validity_policies
    WHERE tenant_id=? AND course_id=? LIMIT 1
  `).bind(auth.tenantId, courseId).first()

  const id = existing ? String(existing.id) : crypto.randomUUID()
  const version = Number(existing?.version ?? 0) + 1
  const now = new Date().toISOString()
  const value = validated.value

  await db.batch([
    db.prepare(`
      INSERT INTO academy_certificate_validity_policies (
        id, tenant_id, course_id, validity_mode, validity_months,
        source_reference, note, version, confirmed_by, confirmed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id,course_id) DO UPDATE SET
        validity_mode=excluded.validity_mode,
        validity_months=excluded.validity_months,
        source_reference=excluded.source_reference,
        note=excluded.note,
        version=excluded.version,
        confirmed_by=excluded.confirmed_by,
        confirmed_at=excluded.confirmed_at,
        updated_at=excluded.updated_at
    `).bind(
      id, auth.tenantId, courseId, value.mode, value.validityMonths,
      value.sourceReference, value.note, version, auth.userId, now, now,
    ),
    db.prepare(`
      INSERT INTO academy_certificate_validity_policy_versions (
        id, tenant_id, course_id, version, validity_mode, validity_months,
        source_reference, note, confirmed_by, confirmed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), auth.tenantId, courseId, version, value.mode, value.validityMonths,
      value.sourceReference, value.note, auth.userId, now, now,
    ),
    auditStatement(db, auth, {
      action: 'certificate_validity.policy_saved',
      resourceType: 'certificate_validity_policy',
      resourceId: id,
      metadata: {
        courseId,
        courseTitle: course.title,
        certificateType: course.certificate_type,
        validityMode: value.mode,
        validityMonths: value.validityMonths,
        version,
        sourceReference: value.sourceReference,
      },
    }),
  ])

  return json({ data: {
    id,
    courseId,
    courseTitle: course.title,
    certificateType: course.certificate_type,
    validityMode: value.mode,
    validityMonths: value.validityMonths,
    sourceReference: value.sourceReference,
    note: value.note,
    version,
    confirmedBy: auth.userId,
    confirmedAt: now,
    appliesTo: 'future_certificates_only',
  } })
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const url = new URL(request.url)
  const courseId = url.searchParams.get('courseId')?.trim() ?? ''
  const confirmed = url.searchParams.get('confirmed') === 'true'
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)
  if (!confirmed) return json({ error: 'Confirmação humana explícita é obrigatória para remover a política' }, 400)

  const existing = await db.prepare(`
    SELECT p.*, c.title AS course_title, c.certificate_type
    FROM academy_certificate_validity_policies p
    JOIN academy_courses c ON c.tenant_id=p.tenant_id AND c.id=p.course_id
    WHERE p.tenant_id=? AND p.course_id=? LIMIT 1
  `).bind(auth.tenantId, courseId).first()
  if (!existing) return json({ data: { courseId, policyConfigured: false }, idempotent: true })

  await db.batch([
    db.prepare('DELETE FROM academy_certificate_validity_policies WHERE tenant_id=? AND course_id=?')
      .bind(auth.tenantId, courseId),
    auditStatement(db, auth, {
      action: 'certificate_validity.policy_removed',
      resourceType: 'certificate_validity_policy',
      resourceId: String(existing.id),
      metadata: {
        courseId,
        courseTitle: existing.course_title,
        certificateType: existing.certificate_type,
        previousVersion: existing.version,
        appliesTo: 'future_certificates_only',
      },
    }),
  ])

  return json({ data: { courseId, policyConfigured: false, appliesTo: 'future_certificates_only' } })
}
