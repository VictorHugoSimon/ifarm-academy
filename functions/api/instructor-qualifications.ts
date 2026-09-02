import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const TYPES = ['degree','technical','council_registration','certification','experience','other']
const VERIFICATION = ['declared','verified','rejected','expired']

function dateOrNull(value: unknown): string | null | undefined {
  if (value == null || value === '') return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const instructorId = new URL(request.url).searchParams.get('instructorId')?.trim() ?? ''
  if (!instructorId) return json({ error: 'instructorId é obrigatório' }, 400)

  const instructor = await db.prepare('SELECT id FROM academy_instructors WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, instructorId).first()
  if (!instructor) return json({ error: 'Instrutor não encontrado neste tenant' }, 404)

  const result = await db.prepare(`
    SELECT * FROM academy_instructor_qualifications
    WHERE tenant_id=? AND instructor_id=?
    ORDER BY verification_status='verified' DESC, created_at DESC
  `).bind(auth.tenantId, instructorId).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id, instructorId: row.instructor_id, qualificationType: row.qualification_type,
    title: row.title, institution: row.institution ?? null, field: row.field ?? null,
    councilName: row.council_name ?? null, registrationNumber: row.registration_number ?? null,
    registrationRegion: row.registration_region ?? null, issuedAt: row.issued_at ?? null,
    expiresAt: row.expires_at ?? null, verificationStatus: row.verification_status,
    evidenceRef: row.evidence_ref ?? null, verifiedBy: row.verified_by ?? null,
    verifiedAt: row.verified_at ?? null, verificationNote: row.verification_note ?? null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const instructorId = String(body.instructorId ?? '').trim()
  const qualificationType = String(body.qualificationType ?? '').trim()
  const title = String(body.title ?? '').trim()
  const issuedAt = dateOrNull(body.issuedAt)
  const expiresAt = dateOrNull(body.expiresAt)
  if (!instructorId || !title) return json({ error: 'instructorId e title são obrigatórios' }, 400)
  if (!TYPES.includes(qualificationType)) return json({ error: 'qualificationType inválido' }, 400)
  if (issuedAt === undefined || expiresAt === undefined) return json({ error: 'Data de emissão/validade inválida' }, 400)
  if (issuedAt && expiresAt && new Date(expiresAt).getTime() <= new Date(issuedAt).getTime()) return json({ error: 'expiresAt deve ser posterior a issuedAt' }, 400)

  const instructor = await db.prepare("SELECT * FROM academy_instructors WHERE tenant_id=? AND id=? AND status='active' LIMIT 1")
    .bind(auth.tenantId, instructorId).first()
  if (!instructor) return json({ error: 'Instrutor ativo não encontrado neste tenant' }, 404)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`
      INSERT INTO academy_instructor_qualifications (
        id,tenant_id,instructor_id,qualification_type,title,institution,field,council_name,
        registration_number,registration_region,issued_at,expires_at,verification_status,
        evidence_ref,declared_by,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'declared',?,?,?,?,?)
    `).bind(
      id, auth.tenantId, instructorId, qualificationType, title,
      String(body.institution ?? '').trim() || null, String(body.field ?? '').trim() || null,
      String(body.councilName ?? '').trim() || null, String(body.registrationNumber ?? '').trim() || null,
      String(body.registrationRegion ?? '').trim() || null, issuedAt, expiresAt,
      String(body.evidenceRef ?? '').trim() || null, auth.userId, now, now,
    ),
    auditStatement(db, auth, { action: 'instructor_qualification.declared', resourceType: 'instructor_qualification', resourceId: id, metadata: { instructorId, qualificationType, title } }),
  ])
  return json({ data: { id, instructorId, qualificationType, title, verificationStatus: 'declared', issuedAt, expiresAt, createdAt: now } }, 201)
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const qualificationId = String(body.qualificationId ?? '').trim()
  const verificationStatus = String(body.verificationStatus ?? '').trim()
  const verificationNote = String(body.verificationNote ?? '').trim()
  if (!qualificationId) return json({ error: 'qualificationId é obrigatório' }, 400)
  if (!VERIFICATION.includes(verificationStatus) || verificationStatus === 'declared') return json({ error: 'verificationStatus deve ser verified, rejected ou expired' }, 400)

  const qualification = await db.prepare('SELECT * FROM academy_instructor_qualifications WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, qualificationId).first()
  if (!qualification) return json({ error: 'Qualificação não encontrada neste tenant' }, 404)
  if (verificationStatus === 'verified' && qualification.expires_at && new Date(String(qualification.expires_at)).getTime() <= Date.now()) {
    return json({ error: 'Qualificação vencida não pode ser marcada como verificada' }, 409)
  }

  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`
      UPDATE academy_instructor_qualifications
      SET verification_status=?,verified_by=?,verified_at=?,verification_note=?,updated_at=?
      WHERE tenant_id=? AND id=?
    `).bind(verificationStatus, auth.userId, now, verificationNote || null, now, auth.tenantId, qualificationId),
    auditStatement(db, auth, {
      action: 'instructor_qualification.verification_changed', resourceType: 'instructor_qualification', resourceId: qualificationId,
      metadata: { instructorId: qualification.instructor_id, previousStatus: qualification.verification_status, verificationStatus, verificationNote },
    }),
  ])
  return json({ data: { id: qualificationId, instructorId: qualification.instructor_id, verificationStatus, verifiedBy: auth.userId, verifiedAt: now, verificationNote: verificationNote || null } })
}
