import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const allowedRoles = ['academy_admin', 'ifarm_admin']
const scopes = new Set(['tenant', 'course', 'student'])
const periods = new Set(['day', 'month'])

function positiveInt(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 100_000_000) return NaN
  return parsed
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const rows = await db.prepare(`
    SELECT id, tenant_id, scope_type, scope_id, period, version,
           max_provider_requests, max_request_chars, status, rationale,
           approved_by, approved_at, archived_at, created_at
    FROM academy_tutor_usage_policies
    WHERE tenant_id=?
    ORDER BY created_at DESC
    LIMIT 200
  `).bind(auth.tenantId).all()
  return json({ data: rows.results })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const scopeType = String(body.scopeType ?? '').trim()
  const period = String(body.period ?? '').trim()
  const scopeIdRaw = String(body.scopeId ?? '').trim()
  const scopeId = scopeType === 'tenant' ? null : scopeIdRaw
  const maxProviderRequests = positiveInt(body.maxProviderRequests)
  const maxRequestChars = positiveInt(body.maxRequestChars)
  const rationale = String(body.rationale ?? '').replace(/\s+/g, ' ').trim()

  if (!scopes.has(scopeType)) return json({ error: 'scopeType inválido' }, 400)
  if (!periods.has(period)) return json({ error: 'period inválido' }, 400)
  if (scopeType !== 'tenant' && !scopeId) return json({ error: 'scopeId é obrigatório para curso/aluno' }, 400)
  if (Number.isNaN(maxProviderRequests) || Number.isNaN(maxRequestChars)) return json({ error: 'Limites devem ser inteiros positivos' }, 400)
  if (maxProviderRequests == null && maxRequestChars == null) return json({ error: 'Informe ao menos um limite de uso' }, 400)
  if (rationale.length < 10 || rationale.length > 600) return json({ error: 'Justificativa deve ter entre 10 e 600 caracteres' }, 400)

  if (scopeType === 'course') {
    const course = await db.prepare('SELECT id FROM academy_courses WHERE tenant_id=? AND id=? LIMIT 1')
      .bind(auth.tenantId, scopeId).first()
    if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  }
  if (scopeType === 'student') {
    const student = await db.prepare('SELECT id FROM academy_enrollments WHERE tenant_id=? AND student_id=? LIMIT 1')
      .bind(auth.tenantId, scopeId).first()
    if (!student) return json({ error: 'Aluno não encontrado em matrículas deste tenant' }, 404)
  }

  const versionRow = await db.prepare(`
    SELECT COALESCE(MAX(version),0) AS version
    FROM academy_tutor_usage_policies
    WHERE tenant_id=? AND scope_type=? AND COALESCE(scope_id,'')=COALESCE(?, '') AND period=?
  `).bind(auth.tenantId, scopeType, scopeId, period).first()
  const version = Number(versionRow?.version ?? 0) + 1
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  const statements: any[] = [
    db.prepare(`
      UPDATE academy_tutor_usage_policies
      SET status='archived', archived_at=?
      WHERE tenant_id=? AND scope_type=? AND COALESCE(scope_id,'')=COALESCE(?, '')
        AND period=? AND status='active'
    `).bind(now, auth.tenantId, scopeType, scopeId, period),
    db.prepare(`
      INSERT INTO academy_tutor_usage_policies (
        id, tenant_id, scope_type, scope_id, period, version,
        max_provider_requests, max_request_chars, status, rationale,
        approved_by, approved_at, archived_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL, ?)
    `).bind(
      id, auth.tenantId, scopeType, scopeId, period, version,
      maxProviderRequests, maxRequestChars, rationale,
      auth.userId, now, now,
    ),
    auditStatement(db, auth, {
      action: 'tutor.usage_policy.published',
      resourceType: 'tutor_usage_policy',
      resourceId: id,
      metadata: { scopeType, scopeId, period, version, maxProviderRequests, maxRequestChars },
    }),
  ]
  await db.batch(statements)

  return json({ data: { id, scopeType, scopeId, period, version, maxProviderRequests, maxRequestChars, status: 'active', rationale, approvedBy: auth.userId, approvedAt: now } }, 201)
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const id = new URL(request.url).searchParams.get('id')?.trim() ?? ''
  if (!id) return json({ error: 'id é obrigatório' }, 400)

  const row = await db.prepare(`
    SELECT id, status FROM academy_tutor_usage_policies
    WHERE tenant_id=? AND id=? LIMIT 1
  `).bind(auth.tenantId, id).first()
  if (!row) return json({ error: 'Política não encontrada' }, 404)
  if (String(row.status) !== 'active') return json({ data: { id, status: 'archived' }, idempotent: true })

  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`UPDATE academy_tutor_usage_policies SET status='archived', archived_at=? WHERE tenant_id=? AND id=? AND status='active'`)
      .bind(now, auth.tenantId, id),
    auditStatement(db, auth, {
      action: 'tutor.usage_policy.archived',
      resourceType: 'tutor_usage_policy',
      resourceId: id,
    }),
  ])
  return json({ data: { id, status: 'archived', archivedAt: now } })
}
