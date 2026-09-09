import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { buildTutorChunks } from './_tutor'
import { bodyJson, dbOr503, json, safeJson, type Env } from './_shared'

const allowedRoles = ['academy_admin', 'academy_instructor', 'instructor', 'ifarm_admin']

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const courseId = String(body.courseId ?? '').trim()
  if (!courseId) return json({ error: 'courseId é obrigatório' }, 400)

  const course = await db.prepare(`
    SELECT id, title, status FROM academy_courses
    WHERE tenant_id=? AND id=? LIMIT 1
  `).bind(auth.tenantId, courseId).first()
  if (!course) return json({ error: 'Curso não encontrado neste tenant' }, 404)
  if (String(course.status) !== 'published') {
    return json({ error: 'Somente cursos publicados podem alimentar o Tutor IA' }, 409)
  }

  const lessons = await db.prepare(`
    SELECT id, title, content_json
    FROM academy_course_lessons
    WHERE tenant_id=? AND course_id=?
    ORDER BY module_id, position, created_at
  `).bind(auth.tenantId, courseId).all()

  const now = new Date().toISOString()
  const statements: any[] = [
    db.prepare('DELETE FROM academy_tutor_source_chunks WHERE tenant_id=? AND course_id=?')
      .bind(auth.tenantId, courseId),
  ]
  let chunkCount = 0

  for (const lesson of lessons.results as any[]) {
    const chunks = buildTutorChunks(safeJson(lesson.content_json, {}))
    for (const chunk of chunks) {
      const id = `${lesson.id}:${chunk.sourceType}:${chunk.chunkIndex}`
      const contentHash = await sha256(chunk.text)
      statements.push(db.prepare(`
        INSERT INTO academy_tutor_source_chunks (
          id, tenant_id, course_id, lesson_id, chunk_index, source_title,
          source_type, content_text, content_hash, indexed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        auth.tenantId,
        courseId,
        String(lesson.id),
        chunk.chunkIndex,
        String(lesson.title),
        chunk.sourceType,
        chunk.text,
        contentHash,
        now,
      ))
      chunkCount += 1
    }
  }

  statements.push(auditStatement(db, auth, {
    action: 'tutor.sources.rebuilt',
    resourceType: 'course',
    resourceId: courseId,
    metadata: { lessonCount: lessons.results.length, chunkCount, mode: 'evidence_only' },
  }))

  await db.batch(statements)
  return json({ data: { courseId, courseTitle: course.title, lessonCount: lessons.results.length, chunkCount, indexedAt: now } })
}
