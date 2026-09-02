import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ROLES = ['author','instructor','reviewer','technical_responsible']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const courseId = new URL(request.url).searchParams.get('courseId')?.trim() ?? ''

  const result = await db.prepare(`
    SELECT r.*, c.title AS course_title, i.user_id, i.display_name_snapshot,
      q.title AS qualification_title, q.verification_status AS qualification_status,
      q.expires_at AS qualification_expires_at
    FROM academy_course_instructor_roles r
    JOIN academy_courses c ON c.tenant_id=r.tenant_id AND c.id=r.course_id
    JOIN academy_instructors i ON i.tenant_id=r.tenant_id AND i.id=r.instructor_id
    LEFT JOIN academy_instructor_qualifications q ON q.tenant_id=r.tenant_id AND q.id=r.qualification_id
    WHERE r.tenant_id=? AND (?='' OR r.course_id=?)
    ORDER BY r.status='inactive', c.title, r.role, i.display_name_snapshot
  `).bind(auth.tenantId, courseId, courseId).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id, courseId: row.course_id, courseTitle: row.course_title,
    instructorId: row.instructor_id, userId: row.user_id, displayName: row.display_name_snapshot,
    role: row.role, qualificationId: row.qualification_id ?? null,
    qualificationTitle: row.qualification_title ?? null, qualificationStatus: row.qualification_status ?? null,
    qualificationExpiresAt: row.qualification_expires_at ?? null,
    suitabilityConfirmed: Number(row.suitability_confirmed) === 1,
    suitabilityConfirmedBy: row.suitability_confirmed_by ?? null,
    suitabilityConfirmedAt: row.suitability_confirmed_at ?? null,
    suitabilityNote: row.suitability_note ?? null, status: row.status,
    assignedBy: row.assigned_by, createdAt: row.created_at, updatedAt: row.updated_at,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const courseId = String(body.courseId ?? '').trim()
  const instructorId = String(body.instructorId ?? '').trim()
  const role = String(body.role ?? '').trim()
  const qualificationId = String(body.qualificationId ?? '').trim() || null
  const suitabilityConfirmed = body.suitabilityConfirmed === true
  const suitabilityNote = String(body.suitabilityNote ?? '').trim()
  if (!courseId || !instructorId) return json({ error: 'courseId e instructorId são obrigatórios' }, 400)
  if (!ROLES.includes(role)) return json({ error: 'role inválido' }, 400)

  const course = await db.prepare('SELECT id,title FROM academy_courses WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, courseId).first()
  if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  const instructor = await db.prepare("SELECT * FROM academy_instructors WHERE tenant_id=? AND id=? AND status='active' LIMIT 1")
    .bind(auth.tenantId, instructorId).first()
  if (!instructor) return json({ error: 'Instrutor ativo não encontrado neste tenant' }, 404)

  let qualification: any = null
  if (qualificationId) {
    qualification = await db.prepare(`SELECT * FROM academy_instructor_qualifications WHERE tenant_id=? AND instructor_id=? AND id=? LIMIT 1`)
      .bind(auth.tenantId, instructorId, qualificationId).first()
    if (!qualification) return json({ error: 'Qualificação não pertence ao instrutor/tenant' }, 404)
  }

  if (role === 'technical_responsible') {
    if (!qualificationId || !qualification) return json({ error: 'Responsável técnico exige qualificationId' }, 400)
    if (String(qualification.verification_status) !== 'verified') return json({ error: 'Responsável técnico exige qualificação previamente verificada' }, 409)
    if (qualification.expires_at && new Date(String(qualification.expires_at)).getTime() <= Date.now()) return json({ error: 'Qualificação do responsável técnico está vencida' }, 409)
    if (!suitabilityConfirmed || !suitabilityNote) {
      return json({ error: 'Responsável técnico exige confirmação humana explícita e justificativa de adequação ao curso' }, 400)
    }
  }

  const existing = await db.prepare(`
    SELECT * FROM academy_course_instructor_roles
    WHERE tenant_id=? AND course_id=? AND instructor_id=? AND role=? AND status='active' LIMIT 1
  `).bind(auth.tenantId, courseId, instructorId, role).first()
  if (existing) return json({ data: { id: existing.id, courseId, instructorId, role, status: 'active' }, idempotent: true })

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`
      INSERT INTO academy_course_instructor_roles (
        id,tenant_id,course_id,instructor_id,role,qualification_id,suitability_confirmed,
        suitability_confirmed_by,suitability_confirmed_at,suitability_note,status,assigned_by,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,'active',?,?,?)
    `).bind(
      id, auth.tenantId, courseId, instructorId, role, qualificationId,
      suitabilityConfirmed ? 1 : 0, suitabilityConfirmed ? auth.userId : null,
      suitabilityConfirmed ? now : null, suitabilityNote || null, auth.userId, now, now,
    ),
    auditStatement(db, auth, {
      action: 'course_instructor.assigned', resourceType: 'course_instructor_role', resourceId: id,
      metadata: {
        courseId, courseTitle: course.title, instructorId, instructorUserId: instructor.user_id,
        role, qualificationId, suitabilityConfirmed,
        warning: role === 'technical_responsible' ? 'Human suitability confirmation recorded; Academy does not infer legal habilitation.' : undefined,
      },
    }),
  ])

  return json({ data: {
    id, courseId, courseTitle: course.title, instructorId, displayName: instructor.display_name_snapshot,
    role, qualificationId, qualificationTitle: qualification?.title ?? null,
    suitabilityConfirmed, suitabilityConfirmedBy: suitabilityConfirmed ? auth.userId : null,
    suitabilityConfirmedAt: suitabilityConfirmed ? now : null,
    suitabilityNote: suitabilityNote || null, status: 'active', createdAt: now,
  } }, 201)
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const roleId = new URL(request.url).searchParams.get('roleId')?.trim() ?? ''
  if (!roleId) return json({ error: 'roleId é obrigatório' }, 400)

  const existing = await db.prepare('SELECT * FROM academy_course_instructor_roles WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, roleId).first()
  if (!existing) return json({ error: 'Vínculo não encontrado neste tenant' }, 404)
  if (String(existing.status) === 'inactive') return json({ data: { id: roleId, status: 'inactive' }, idempotent: true })
  const now = new Date().toISOString()
  await db.batch([
    db.prepare("UPDATE academy_course_instructor_roles SET status='inactive',updated_at=? WHERE tenant_id=? AND id=?")
      .bind(now, auth.tenantId, roleId),
    auditStatement(db, auth, { action: 'course_instructor.inactivated', resourceType: 'course_instructor_role', resourceId: roleId, metadata: { courseId: existing.course_id, instructorId: existing.instructor_id, role: existing.role } }),
  ])
  return json({ data: { id: roleId, status: 'inactive', updatedAt: now } })
}
