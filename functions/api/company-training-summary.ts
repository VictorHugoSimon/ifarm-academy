import { requireAdminContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

const enterpriseRoles = ['academy_admin', 'ifarm_admin', 'company_admin', 'academy_company_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, enterpriseRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? ''
  if (!companyId) return json({ error: 'companyId é obrigatório' }, 400)

  const company = await db.prepare(`
    SELECT id, name, status FROM academy_companies
    WHERE tenant_id=? AND id=? LIMIT 1
  `).bind(auth.tenantId, companyId).first()
  if (!company) return json({ error: 'Empresa não encontrada neste tenant' }, 404)

  const members = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM academy_company_members
    WHERE tenant_id=? AND company_id=? AND status='active'
  `).bind(auth.tenantId, companyId).first()

  const assignmentStats = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN a.required=1 THEN 1 ELSE 0 END) AS required_total,
      SUM(CASE WHEN a.status='cancelled' THEN 1 ELSE 0 END) AS cancelled_total,
      SUM(CASE WHEN a.status!='cancelled' AND e.status='completed' THEN 1 ELSE 0 END) AS completed_total,
      SUM(CASE WHEN a.status!='cancelled' AND e.status!='completed' AND a.due_at IS NOT NULL AND datetime(a.due_at) < datetime('now') THEN 1 ELSE 0 END) AS overdue_total
    FROM academy_course_assignments a
    JOIN academy_company_members m
      ON m.tenant_id=a.tenant_id AND m.id=a.member_id AND m.company_id=a.company_id
    LEFT JOIN academy_enrollments e
      ON e.tenant_id=a.tenant_id AND e.course_id=a.course_id AND e.student_id=m.user_id
    WHERE a.tenant_id=? AND a.company_id=?
  `).bind(auth.tenantId, companyId).first()

  const certificateStats = await db.prepare(`
    SELECT COUNT(DISTINCT cert.id) AS valid_certificates
    FROM academy_course_assignments a
    JOIN academy_company_members m
      ON m.tenant_id=a.tenant_id AND m.id=a.member_id AND m.company_id=a.company_id
    JOIN academy_certificates cert
      ON cert.tenant_id=a.tenant_id AND cert.course_id=a.course_id
      AND cert.student_id=m.user_id AND cert.status='valid'
    WHERE a.tenant_id=? AND a.company_id=? AND a.status!='cancelled'
  `).bind(auth.tenantId, companyId).first()

  const total = Number(assignmentStats?.total ?? 0)
  const cancelled = Number(assignmentStats?.cancelled_total ?? 0)
  const activeAssignments = Math.max(0, total - cancelled)
  const completed = Number(assignmentStats?.completed_total ?? 0)
  const completionPercent = activeAssignments > 0 ? Math.round((completed / activeAssignments) * 100) : 0

  return json({ data: {
    company: { id: company.id, name: company.name, status: company.status },
    activeMembers: Number(members?.total ?? 0),
    assignments: activeAssignments,
    requiredAssignments: Number(assignmentStats?.required_total ?? 0),
    completedAssignments: completed,
    overdueAssignments: Number(assignmentStats?.overdue_total ?? 0),
    validCertificates: Number(certificateStats?.valid_certificates ?? 0),
    completionPercent,
  } })
}
