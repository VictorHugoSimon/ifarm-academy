import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const pathRoles = ['academy_admin', 'ifarm_admin', 'academy_instructor', 'instructor']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, pathRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const result = await db.prepare(`
    SELECT
      p.*,
      (SELECT COUNT(*) FROM academy_learning_path_courses pc
       WHERE pc.tenant_id=p.tenant_id AND pc.path_id=p.id) AS course_count
    FROM academy_learning_paths p
    WHERE p.tenant_id=?
    ORDER BY p.status='published' DESC, p.updated_at DESC
  `).bind(auth.tenantId).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    courseCount: Number(row.course_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, pathRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  if (title.length < 2 || title.length > 180) return json({ error: 'Título da trilha inválido' }, 400)
  if (description.length > 1200) return json({ error: 'Descrição da trilha excede o limite' }, 400)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`
      INSERT INTO academy_learning_paths (
        id, tenant_id, title, description, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)
    `).bind(id, auth.tenantId, title, description || null, auth.userId, now, now),
    auditStatement(db, auth, {
      action: 'learning_path.created',
      resourceType: 'learning_path',
      resourceId: id,
      metadata: { title },
    }),
  ])

  return json({ data: { id, title, description, status: 'draft', courseCount: 0, createdAt: now, updatedAt: now } }, 201)
}
