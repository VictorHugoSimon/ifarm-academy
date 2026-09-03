import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ADMIN_ROLES = ['academy_admin', 'ifarm_admin']

function isAdmin(roles: string[]) {
  return roles.some((role) => ADMIN_ROLES.includes(role))
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let instructorId: string | null = null
  if (!isAdmin(auth.roles)) {
    const instructor = await db.prepare(`SELECT id FROM academy_instructors WHERE tenant_id=? AND user_id=? AND status='active' LIMIT 1`)
      .bind(auth.tenantId, auth.userId).first()
    if (!instructor) return json({ data: [] })
    instructorId = String(instructor.id)
  }

  const result = await db.prepare(`
    SELECT s.*, c.title AS course_title, c.status AS course_status,
      i.display_name_snapshot AS instructor_name,
      r.id AS active_rule_id, r.version AS active_rule_version,
      r.calculation_mode, r.ifarm_share_value, r.instructor_share_value,
      r.partner_share_value, r.gateway_fee_responsibility,
      r.valid_from, r.valid_until
    FROM academy_marketplace_submissions s
    JOIN academy_courses c ON c.id=s.course_id AND c.tenant_id=s.tenant_id
    JOIN academy_instructors i ON i.id=s.submitter_instructor_id AND i.tenant_id=s.tenant_id
    LEFT JOIN academy_marketplace_commission_rules r
      ON r.tenant_id=s.tenant_id AND r.submission_id=s.id AND r.status='active'
    WHERE s.tenant_id=? AND (? IS NULL OR s.submitter_instructor_id=?)
    ORDER BY s.updated_at DESC
  `).bind(auth.tenantId, instructorId, instructorId).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id,
    courseId: row.course_id,
    courseTitle: row.course_title,
    courseStatus: row.course_status,
    submitterInstructorId: row.submitter_instructor_id,
    instructorName: row.instructor_name,
    status: row.status,
    submissionNote: row.submission_note ?? null,
    reviewNote: row.review_note ?? null,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at ?? null,
    publishedAt: row.published_at ?? null,
    activeCommissionRule: row.active_rule_id ? {
      id: row.active_rule_id,
      version: Number(row.active_rule_version),
      calculationMode: row.calculation_mode,
      ifarmShareValue: Number(row.ifarm_share_value),
      instructorShareValue: Number(row.instructor_share_value),
      partnerShareValue: Number(row.partner_share_value),
      gatewayFeeResponsibility: row.gateway_fee_responsibility,
      validFrom: row.valid_from,
      validUntil: row.valid_until ?? null,
    } : null,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const courseId = String(body.courseId ?? '').trim()
  const submissionNote = String(body.submissionNote ?? '').trim() || null
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const instructor = await db.prepare(`SELECT id,display_name_snapshot FROM academy_instructors WHERE tenant_id=? AND user_id=? AND status='active' LIMIT 1`)
    .bind(auth.tenantId, auth.userId).first()
  if (!instructor) return json({ error: 'Usuário autenticado não possui perfil de instrutor ativo' }, 403)

  const course = await db.prepare(`SELECT id,title,status FROM academy_courses WHERE tenant_id=? AND id=? LIMIT 1`)
    .bind(auth.tenantId, courseId).first()
  if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  if (String(course.status) !== 'published') return json({ error: 'Somente curso academicamente publicado pode ser submetido ao marketplace' }, 409)

  const role = await db.prepare(`
    SELECT id FROM academy_course_instructor_roles
    WHERE tenant_id=? AND course_id=? AND instructor_id=? AND role IN ('author','instructor') AND status='active'
    LIMIT 1
  `).bind(auth.tenantId, courseId, instructor.id).first()
  if (!role) return json({ error: 'Instrutor precisa ser autor ou instrutor ativo do curso' }, 403)

  const existing = await db.prepare(`
    SELECT * FROM academy_marketplace_submissions
    WHERE tenant_id=? AND course_id=? AND submitter_instructor_id=? LIMIT 1
  `).bind(auth.tenantId, courseId, instructor.id).first()

  const now = new Date().toISOString()
  if (existing) {
    const current = String(existing.status)
    if (!['changes_requested', 'rejected'].includes(current)) {
      return json({ data: { id: existing.id, status: current }, idempotent: true })
    }
    await db.batch([
      db.prepare(`UPDATE academy_marketplace_submissions SET status='submitted',submission_note=?,review_note=NULL,submitted_at=?,reviewed_by=NULL,reviewed_at=NULL,updated_at=? WHERE tenant_id=? AND id=?`)
        .bind(submissionNote, now, now, auth.tenantId, existing.id),
      auditStatement(db, auth, { action: 'marketplace.resubmitted', resourceType: 'marketplace_submission', resourceId: String(existing.id), metadata: { courseId, previousStatus: current } }),
    ])
    return json({ data: { id: existing.id, status: 'submitted', submittedAt: now } })
  }

  const id = crypto.randomUUID()
  await db.batch([
    db.prepare(`
      INSERT INTO academy_marketplace_submissions (
        id,tenant_id,course_id,submitter_instructor_id,status,submission_note,
        submitted_at,created_at,updated_at
      ) VALUES (?,?,?,?,'submitted',?,?,?,?)
    `).bind(id, auth.tenantId, courseId, instructor.id, submissionNote, now, now, now),
    auditStatement(db, auth, { action: 'marketplace.submitted', resourceType: 'marketplace_submission', resourceId: id, metadata: { courseId, instructorId: instructor.id } }),
  ])

  return json({ data: { id, courseId, status: 'submitted', submittedAt: now } }, 201)
}
