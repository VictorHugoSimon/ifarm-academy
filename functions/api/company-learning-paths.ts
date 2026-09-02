import { auditStatement } from './_audit'
import { requireCompanyScope, requireEnterpriseContext } from './_enterpriseAuth'
import { normalizeRenewalMonths } from './_renewal'
import { bodyJson, dbOr503, json, type Env } from './_shared'

interface PathCourseInput {
  courseId: string
  required: boolean
  renewalMonths: number | null
}

function parseCourses(value: unknown, defaultRenewalMonths: number | null): PathCourseInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null
  const seen = new Set<string>()
  const output: PathCourseInput[] = []
  for (const raw of value as Array<Record<string, unknown>>) {
    const courseId = String(raw?.courseId ?? '').trim()
    if (!courseId || seen.has(courseId)) return null
    const parsedRenewal = normalizeRenewalMonths(raw?.renewalMonths)
    if (parsedRenewal === undefined) return null
    seen.add(courseId)
    output.push({
      courseId,
      required: raw?.required !== false,
      renewalMonths: parsedRenewal == null ? defaultRenewalMonths : parsedRenewal,
    })
  }
  return output
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? ''
  if (!companyId) return json({ error: 'companyId é obrigatório' }, 400)
  const denied = requireCompanyScope(auth, companyId)
  if (denied) return denied

  const company = await db.prepare('SELECT id FROM academy_companies WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, companyId).first()
  if (!company) return json({ error: 'Empresa não encontrada neste tenant' }, 404)

  const [pathsResult, coursesResult] = await Promise.all([
    db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM academy_company_path_assignments a
         WHERE a.tenant_id=p.tenant_id AND a.company_id=p.company_id AND a.path_id=p.id AND a.status!='cancelled') AS assignments
      FROM academy_company_learning_paths p
      WHERE p.tenant_id=? AND p.company_id=?
      ORDER BY p.status='inactive', p.name
    `).bind(auth.tenantId, companyId).all(),
    db.prepare(`
      SELECT pc.*, c.title AS course_title, c.status AS course_status
      FROM academy_company_learning_path_courses pc
      JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id
      WHERE pc.tenant_id=? AND pc.company_id=?
      ORDER BY pc.path_id, pc.position
    `).bind(auth.tenantId, companyId).all(),
  ])

  const coursesByPath = new Map<string, any[]>()
  for (const row of coursesResult.results as any[]) {
    const list = coursesByPath.get(String(row.path_id)) ?? []
    list.push({
      id: row.id,
      courseId: row.course_id,
      courseTitle: row.course_title,
      courseStatus: row.course_status,
      required: Number(row.required) === 1,
      renewalMonths: row.renewal_months == null ? null : Number(row.renewal_months),
      position: Number(row.position),
    })
    coursesByPath.set(String(row.path_id), list)
  }

  return json({ data: (pathsResult.results as any[]).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description ?? '',
    status: row.status,
    defaultRenewalMonths: row.default_renewal_months == null ? null : Number(row.default_renewal_months),
    assignments: Number(row.assignments ?? 0),
    courses: coursesByPath.get(String(row.id)) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const companyId = String(body.companyId ?? '').trim()
  const name = String(body.name ?? '').trim()
  const description = String(body.description ?? '').trim()
  const defaultRenewalMonths = normalizeRenewalMonths(body.defaultRenewalMonths)
  if (!companyId || !name) return json({ error: 'companyId e name são obrigatórios' }, 400)
  if (defaultRenewalMonths === undefined) return json({ error: 'defaultRenewalMonths inválido' }, 400)
  const courses = parseCourses(body.courses, defaultRenewalMonths)
  if (!courses) return json({ error: 'courses deve conter entre 1 e 50 cursos únicos e válidos' }, 400)

  const denied = requireCompanyScope(auth, companyId)
  if (denied) return denied

  const company = await db.prepare('SELECT id, status FROM academy_companies WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, companyId).first()
  if (!company) return json({ error: 'Empresa não encontrada neste tenant' }, 404)
  if (String(company.status) !== 'active') return json({ error: 'Empresa inativa não permite criar trilhas' }, 409)

  const courseRows = await db.prepare(`
    SELECT id, title, status FROM academy_courses
    WHERE tenant_id=? AND id IN (${courses.map(() => '?').join(',')})
  `).bind(auth.tenantId, ...courses.map((item) => item.courseId)).all()
  const found = new Map((courseRows.results as any[]).map((row) => [String(row.id), row]))
  for (const course of courses) {
    const row = found.get(course.courseId)
    if (!row) return json({ error: `Curso ${course.courseId} não encontrado neste tenant` }, 404)
    if (String(row.status) !== 'published') return json({ error: `Curso ${String(row.title)} precisa estar publicado` }, 409)
  }

  const pathId = crypto.randomUUID()
  const now = new Date().toISOString()
  const statements: any[] = [
    db.prepare(`
      INSERT INTO academy_company_learning_paths (
        id, tenant_id, company_id, name, description, status,
        default_renewal_months, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).bind(pathId, auth.tenantId, companyId, name, description || null, defaultRenewalMonths, auth.userId, now, now),
  ]

  courses.forEach((course, position) => {
    statements.push(db.prepare(`
      INSERT INTO academy_company_learning_path_courses (
        id, tenant_id, company_id, path_id, course_id, position,
        required, renewal_months, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), auth.tenantId, companyId, pathId, course.courseId,
      position, course.required ? 1 : 0, course.renewalMonths, now,
    ))
  })

  statements.push(auditStatement(db, auth, {
    action: 'company_learning_path.created',
    resourceType: 'company_learning_path',
    resourceId: pathId,
    metadata: {
      companyId,
      name,
      defaultRenewalMonths,
      courses: courses.map((item) => ({ courseId: item.courseId, required: item.required, renewalMonths: item.renewalMonths })),
    },
  }))
  await db.batch(statements)

  return json({ data: { id: pathId, companyId, name, description, status: 'active', defaultRenewalMonths, courses } }, 201)
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireEnterpriseContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const pathId = new URL(request.url).searchParams.get('pathId')?.trim() ?? ''
  if (!pathId) return json({ error: 'pathId é obrigatório' }, 400)
  const path = await db.prepare('SELECT * FROM academy_company_learning_paths WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, pathId).first()
  if (!path) return json({ error: 'Trilha não encontrada neste tenant' }, 404)
  const denied = requireCompanyScope(auth, String(path.company_id))
  if (denied) return denied
  if (String(path.status) === 'inactive') return json({ data: { id: pathId, status: 'inactive' }, idempotent: true })

  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`UPDATE academy_company_learning_paths SET status='inactive', updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(now, auth.tenantId, pathId),
    auditStatement(db, auth, {
      action: 'company_learning_path.inactivated',
      resourceType: 'company_learning_path',
      resourceId: pathId,
      metadata: { companyId: path.company_id, name: path.name },
    }),
  ])
  return json({ data: { id: pathId, status: 'inactive', updatedAt: now } })
}
