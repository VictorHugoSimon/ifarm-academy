import { auditStatement } from './_audit'
import { requireEnterpriseContext, requireGlobalEnterpriseAdmin } from './_enterpriseAuth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const scoped = !auth.canManageAllCompanies
  const result = await db.prepare(`
    SELECT
      c.*,
      (SELECT COUNT(*) FROM academy_company_members m
       WHERE m.tenant_id=c.tenant_id AND m.company_id=c.id AND m.status='active') AS active_members,
      (SELECT COUNT(*) FROM academy_course_assignments a
       WHERE a.tenant_id=c.tenant_id AND a.company_id=c.id AND a.status!='cancelled') AS assignments
    FROM academy_companies c
    WHERE c.tenant_id=? ${scoped ? 'AND c.id=?' : ''}
    ORDER BY c.status='active' DESC, c.name
  `).bind(...(scoped ? [auth.tenantId, auth.companyScopeId] : [auth.tenantId])).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    documentLabel: row.document_label ?? null,
    status: row.status,
    activeMembers: Number(row.active_members ?? 0),
    assignments: Number(row.assignments ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const globalDenied = requireGlobalEnterpriseAdmin(auth)
  if (globalDenied) return globalDenied
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const name = String(body.name ?? '').trim()
  const documentLabel = String(body.documentLabel ?? '').trim() || null
  if (name.length < 2 || name.length > 160) return json({ error: 'Nome da empresa inválido' }, 400)
  if (documentLabel && documentLabel.length > 80) return json({ error: 'Identificação documental excede o limite' }, 400)

  const duplicate = await db.prepare(`
    SELECT id FROM academy_companies
    WHERE tenant_id=? AND lower(name)=lower(?) AND status='active'
    LIMIT 1
  `).bind(auth.tenantId, name).first()
  if (duplicate) return json({ error: 'Já existe empresa ativa com este nome', companyId: duplicate.id }, 409)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`
      INSERT INTO academy_companies (
        id, tenant_id, name, document_label, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
    `).bind(id, auth.tenantId, name, documentLabel, auth.userId, now, now),
    auditStatement(db, auth, {
      action: 'company.created',
      resourceType: 'company',
      resourceId: id,
      metadata: { name },
    }),
  ])

  return json({ data: { id, name, documentLabel, status: 'active', activeMembers: 0, assignments: 0, createdAt: now, updatedAt: now } }, 201)
}
