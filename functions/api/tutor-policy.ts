import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { purgeTutorIndex, rebuildTutorIndex } from './_tutorIndex'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const readerRoles = ['academy_admin', 'academy_instructor', 'instructor', 'ifarm_admin']
const approverRoles = ['academy_admin', 'ifarm_admin']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, readerRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const courseId = new URL(request.url).searchParams.get('courseId')?.trim() ?? ''
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const row = await db.prepare(`
    SELECT c.id AS course_id, c.title AS course_title, c.status AS course_status,
           p.enabled, p.approved_by, p.approved_at, p.disabled_at,
           p.last_indexed_at, p.last_indexed_course_updated_at,
           (SELECT COUNT(*) FROM academy_tutor_source_chunks sc
             WHERE sc.tenant_id=c.tenant_id AND sc.course_id=c.id) AS chunk_count
    FROM academy_courses c
    LEFT JOIN academy_tutor_course_policies p
      ON p.tenant_id=c.tenant_id AND p.course_id=c.id
    WHERE c.tenant_id=? AND c.id=?
    LIMIT 1
  `).bind(auth.tenantId, courseId).first()

  if (!row) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  return json({ data: {
    courseId: row.course_id,
    courseTitle: row.course_title,
    courseStatus: row.course_status,
    enabled: Number(row.enabled ?? 0) === 1,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    disabledAt: row.disabled_at ?? null,
    lastIndexedAt: row.last_indexed_at ?? null,
    lastIndexedCourseUpdatedAt: row.last_indexed_course_updated_at ?? null,
    chunkCount: Number(row.chunk_count ?? 0),
  }})
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, approverRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const courseId = String(body.courseId ?? '').trim()
  const enabled = body.enabled === true
  if (!courseId || typeof body.enabled !== 'boolean') return json({ error: 'courseId e enabled são obrigatórios' }, 400)

  const course = await db.prepare(`
    SELECT id, title, status FROM academy_courses
    WHERE tenant_id=? AND id=? LIMIT 1
  `).bind(auth.tenantId, courseId).first()
  if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)

  const now = new Date().toISOString()
  if (enabled) {
    await db.batch([
      db.prepare(`
        INSERT INTO academy_tutor_course_policies (
          tenant_id, course_id, enabled, approved_by, approved_at, disabled_at,
          last_indexed_at, last_indexed_course_updated_at, created_at, updated_at
        ) VALUES (?, ?, 1, ?, ?, NULL, NULL, NULL, ?, ?)
        ON CONFLICT(tenant_id, course_id) DO UPDATE SET
          enabled=1,
          approved_by=excluded.approved_by,
          approved_at=excluded.approved_at,
          disabled_at=NULL,
          updated_at=excluded.updated_at
      `).bind(auth.tenantId, courseId, auth.userId, now, now, now),
      auditStatement(db, auth, {
        action: 'tutor.policy.enabled',
        resourceType: 'course',
        resourceId: courseId,
        metadata: { courseStatus: course.status, mode: 'evidence_only' },
      }),
    ])

    let sync: Record<string, unknown> = { status: 'waiting_for_publication' }
    if (String(course.status) === 'published') {
      try {
        const indexed = await rebuildTutorIndex(db, auth.tenantId, courseId)
        sync = { status: 'indexed', chunkCount: indexed.chunkCount, indexedAt: indexed.indexedAt }
      } catch {
        await purgeTutorIndex(db, auth.tenantId, courseId)
        sync = { status: 'failed_safe', message: 'Autorização registrada, mas o índice foi mantido vazio por segurança.' }
      }
    }

    return json({ data: { courseId, enabled: true, approvedBy: auth.userId, approvedAt: now, sync } })
  }

  await db.batch([
    db.prepare(`
      INSERT INTO academy_tutor_course_policies (
        tenant_id, course_id, enabled, approved_by, approved_at, disabled_at,
        last_indexed_at, last_indexed_course_updated_at, created_at, updated_at
      ) VALUES (?, ?, 0, NULL, NULL, ?, NULL, NULL, ?, ?)
      ON CONFLICT(tenant_id, course_id) DO UPDATE SET
        enabled=0,
        disabled_at=excluded.disabled_at,
        last_indexed_at=NULL,
        last_indexed_course_updated_at=NULL,
        updated_at=excluded.updated_at
    `).bind(auth.tenantId, courseId, now, now, now),
    auditStatement(db, auth, {
      action: 'tutor.policy.disabled',
      resourceType: 'course',
      resourceId: courseId,
      metadata: { courseStatus: course.status },
    }),
  ])
  const removedChunks = await purgeTutorIndex(db, auth.tenantId, courseId)

  return json({ data: { courseId, enabled: false, disabledAt: now, removedChunks } })
}
