import { auditStatement } from '../../_audit'
import { requireCompanyScope, requireEnterpriseContext } from '../../_enterpriseAuth'
import { bodyJson, dbOr503, json, type Env } from '../../_shared'

export const onRequestGet = async ({ env, request, params }: { env: Env; request: Request; params: Record<string, string> }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const companyId = String(params.id ?? '').trim()
  if (!companyId) return json({ error: 'companyId é obrigatório' }, 400)
  const scopeDenied = requireCompanyScope(auth, companyId)
  if (scopeDenied) return scopeDenied

  const company = await db.prepare('SELECT id FROM academy_companies WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, companyId).first()
  if (!company) return json({ error: 'Empresa não encontrada neste tenant' }, 404)

  const result = await db.prepare(`
    SELECT
      m.*,
      (SELECT COUNT(*) FROM academy_course_assignments a
       WHERE a.tenant_id=m.tenant_id AND a.member_id=m.id AND a.status!='cancelled') AS assignments,
      (SELECT COUNT(*) FROM academy_course_assignments a
       WHERE a.tenant_id=m.tenant_id AND a.member_id=m.id AND a.status='completed') AS completed_assignments
    FROM academy_company_members m
    WHERE m.tenant_id=? AND m.company_id=?
    ORDER BY m.status='active' DESC, m.display_name_snapshot
  `).bind(auth.tenantId, companyId).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    displayName: row.display_name_snapshot,
    employeeCode: row.employee_code ?? null,
    jobTitle: row.job_title ?? null,
    status: row.status,
    assignments: Number(row.assignments ?? 0),
    completedAssignments: Number(row.completed_assignments ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) })
}

export const onRequestPost = async ({ env, request, params }: { env: Env; request: Request; params: Record<string, string> }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const companyId = String(params.id ?? '').trim()
  if (!companyId) return json({ error: 'companyId é obrigatório' }, 400)
  const scopeDenied = requireCompanyScope(auth, companyId)
  if (scopeDenied) return scopeDenied

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const userId = String(body.userId ?? '').trim()
  const displayName = String(body.displayName ?? '').trim()
  const employeeCode = String(body.employeeCode ?? '').trim() || null
  const jobTitle = String(body.jobTitle ?? '').trim() || null
  if (!userId || userId.length > 160) return json({ error: 'userId do iFarm é obrigatório' }, 400)
  if (displayName.length < 2 || displayName.length > 160) return json({ error: 'Nome do colaborador inválido' }, 400)
  if (employeeCode && employeeCode.length > 80) return json({ error: 'Código do colaborador excede o limite' }, 400)
  if (jobTitle && jobTitle.length > 120) return json({ error: 'Cargo excede o limite' }, 400)

  const company = await db.prepare(`
    SELECT id, status FROM academy_companies
    WHERE tenant_id=? AND id=? LIMIT 1
  `).bind(auth.tenantId, companyId).first()
  if (!company) return json({ error: 'Empresa não encontrada neste tenant' }, 404)
  if (String(company.status) !== 'active') return json({ error: 'Empresa inativa não aceita novos colaboradores' }, 409)

  const existing = await db.prepare(`
    SELECT * FROM academy_company_members
    WHERE tenant_id=? AND company_id=? AND user_id=? LIMIT 1
  `).bind(auth.tenantId, companyId, userId).first()
  const id = existing ? String(existing.id) : crypto.randomUUID()
  const now = new Date().toISOString()

  await db.batch([
    db.prepare(`
      INSERT INTO academy_company_members (
        id, tenant_id, company_id, user_id, display_name_snapshot,
        employee_code, job_title, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      ON CONFLICT(tenant_id, company_id, user_id) DO UPDATE SET
        display_name_snapshot=excluded.display_name_snapshot,
        employee_code=excluded.employee_code,
        job_title=excluded.job_title,
        status='active',
        updated_at=excluded.updated_at
    `).bind(id, auth.tenantId, companyId, userId, displayName, employeeCode, jobTitle, now, now),
    auditStatement(db, auth, {
      action: existing ? 'company_member.reactivated' : 'company_member.created',
      resourceType: 'company_member',
      resourceId: id,
      metadata: { companyId, userId, displayName },
    }),
  ])

  return json({ data: { id, companyId, userId, displayName, employeeCode, jobTitle, status: 'active', assignments: 0, completedAssignments: 0, createdAt: existing?.created_at ?? now, updatedAt: now }, reactivated: Boolean(existing) }, existing ? 200 : 201)
}
