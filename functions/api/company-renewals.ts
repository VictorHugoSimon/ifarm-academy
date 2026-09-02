import { requireCompanyScope, requireEnterpriseContext } from './_enterpriseAuth'
import { evaluateRenewal } from './_renewal'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const url = new URL(request.url)
  const companyId = url.searchParams.get('companyId')?.trim() ?? ''
  const stateFilter = url.searchParams.get('state')?.trim() ?? ''
  if (!companyId) return json({ error: 'companyId é obrigatório' }, 400)
  if (stateFilter && !['due', 'upcoming', 'not_due'].includes(stateFilter)) return json({ error: 'state inválido' }, 400)
  const denied = requireCompanyScope(auth, companyId)
  if (denied) return denied

  const company = await db.prepare('SELECT id FROM academy_companies WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, companyId).first()
  if (!company) return json({ error: 'Empresa não encontrada neste tenant' }, 404)

  const result = await db.prepare(`
    SELECT
      a.id, a.company_id, a.member_id, a.course_id, a.completed_at,
      a.renewal_months, a.renewal_cycle, a.source, a.learning_cycle_id,
      lc.cycle_number AS learning_cycle_number, lc.status AS learning_cycle_status,
      m.user_id, m.display_name_snapshot, m.employee_code, m.job_title,
      c.title AS course_title,
      cert.public_code AS certificate_code, cert.status AS certificate_status,
      EXISTS(
        SELECT 1 FROM academy_course_assignments open_a
        WHERE open_a.tenant_id=a.tenant_id AND open_a.company_id=a.company_id
          AND open_a.member_id=a.member_id AND open_a.course_id=a.course_id
          AND open_a.status IN ('assigned','in_progress')
      ) AS has_open_assignment
    FROM academy_course_assignments a
    JOIN academy_company_members m
      ON m.tenant_id=a.tenant_id AND m.company_id=a.company_id AND m.id=a.member_id
    JOIN academy_courses c
      ON c.tenant_id=a.tenant_id AND c.id=a.course_id
    LEFT JOIN academy_learning_cycles lc
      ON lc.tenant_id=a.tenant_id AND lc.id=a.learning_cycle_id
    LEFT JOIN academy_certificates cert
      ON cert.tenant_id=a.tenant_id AND cert.student_id=m.user_id
      AND cert.course_id=a.course_id AND cert.cycle_id=a.learning_cycle_id
      AND cert.status='valid'
    WHERE a.tenant_id=? AND a.company_id=?
      AND a.status='completed'
      AND a.completed_at IS NOT NULL
      AND a.renewal_months IS NOT NULL
    ORDER BY a.completed_at DESC
  `).bind(auth.tenantId, companyId).all()

  const now = new Date()
  const data = (result.results as any[]).map((row) => {
    const renewal = evaluateRenewal(String(row.completed_at), Number(row.renewal_months), now)
    const canStartNewCycle = ['due', 'upcoming'].includes(renewal.state)
      && Number(row.has_open_assignment ?? 0) === 0
      && String(row.learning_cycle_status ?? '') === 'completed'
    return {
      assignmentId: row.id,
      companyId: row.company_id,
      memberId: row.member_id,
      userId: row.user_id,
      displayName: row.display_name_snapshot,
      employeeCode: row.employee_code ?? null,
      jobTitle: row.job_title ?? null,
      courseId: row.course_id,
      courseTitle: row.course_title,
      learningCycleId: row.learning_cycle_id ?? null,
      learningCycleNumber: row.learning_cycle_number == null ? null : Number(row.learning_cycle_number),
      completedAt: row.completed_at,
      renewalMonths: Number(row.renewal_months),
      renewalCycle: Number(row.renewal_cycle ?? 1),
      renewalState: renewal.state,
      renewalDueAt: renewal.renewalDueAt,
      daysRemaining: renewal.daysRemaining,
      certificateCode: row.certificate_code ?? null,
      certificateStatus: row.certificate_status ?? null,
      source: row.source,
      hasOpenAssignment: Number(row.has_open_assignment ?? 0) === 1,
      canStartNewCycle,
    }
  }).filter((item) => !stateFilter || item.renewalState === stateFilter)
    .sort((left, right) => String(left.renewalDueAt ?? '').localeCompare(String(right.renewalDueAt ?? '')))

  const summary = {
    configured: data.length,
    due: data.filter((item) => item.renewalState === 'due').length,
    upcoming: data.filter((item) => item.renewalState === 'upcoming').length,
    notDue: data.filter((item) => item.renewalState === 'not_due').length,
    readyToStart: data.filter((item) => item.canStartNewCycle).length,
  }

  return json({ data, summary, policy: {
    upcomingWindowDays: 30,
    note: 'A periodicidade é configurada pela operação. A Academy não infere prazo regulatório automaticamente.',
  } })
}
