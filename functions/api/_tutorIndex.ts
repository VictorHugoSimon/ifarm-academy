import { buildTutorChunks } from './_tutor'
import { safeJson } from './_shared'

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export interface TutorIndexResult {
  courseId: string
  courseTitle: string
  lessonCount: number
  chunkCount: number
  indexedAt: string
  courseUpdatedAt: string
}

export async function rebuildTutorIndex(db: any, tenantId: string, courseId: string): Promise<TutorIndexResult> {
  const course = await db.prepare(`
    SELECT c.id, c.title, c.status, c.updated_at,
           p.enabled AS tutor_enabled
    FROM academy_courses c
    LEFT JOIN academy_tutor_course_policies p
      ON p.tenant_id=c.tenant_id AND p.course_id=c.id
    WHERE c.tenant_id=? AND c.id=?
    LIMIT 1
  `).bind(tenantId, courseId).first()

  if (!course) throw new Error('TUTOR_COURSE_NOT_FOUND')
  if (String(course.status) !== 'published') throw new Error('TUTOR_COURSE_NOT_PUBLISHED')
  if (Number(course.tutor_enabled ?? 0) !== 1) throw new Error('TUTOR_CONTENT_NOT_AUTHORIZED')

  const lessons = await db.prepare(`
    SELECT id, title, content_json
    FROM academy_course_lessons
    WHERE tenant_id=? AND course_id=?
    ORDER BY module_id, position, created_at
  `).bind(tenantId, courseId).all()

  const indexedAt = new Date().toISOString()
  const statements: any[] = [
    db.prepare('DELETE FROM academy_tutor_source_chunks WHERE tenant_id=? AND course_id=?')
      .bind(tenantId, courseId),
  ]
  let chunkCount = 0

  for (const lesson of lessons.results as any[]) {
    const chunks = buildTutorChunks(safeJson(lesson.content_json, {}))
    for (const chunk of chunks) {
      const contentHash = await sha256(chunk.text)
      statements.push(db.prepare(`
        INSERT INTO academy_tutor_source_chunks (
          id, tenant_id, course_id, lesson_id, chunk_index, source_title,
          source_type, content_text, content_hash, indexed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `${lesson.id}:${chunk.sourceType}:${chunk.chunkIndex}`,
        tenantId,
        courseId,
        String(lesson.id),
        chunk.chunkIndex,
        String(lesson.title),
        chunk.sourceType,
        chunk.text,
        contentHash,
        indexedAt,
      ))
      chunkCount += 1
    }
  }

  statements.push(db.prepare(`
    UPDATE academy_tutor_course_policies
    SET last_indexed_at=?, last_indexed_course_updated_at=?, updated_at=?
    WHERE tenant_id=? AND course_id=? AND enabled=1
  `).bind(indexedAt, String(course.updated_at ?? indexedAt), indexedAt, tenantId, courseId))

  await db.batch(statements)
  return {
    courseId,
    courseTitle: String(course.title ?? ''),
    lessonCount: lessons.results.length,
    chunkCount,
    indexedAt,
    courseUpdatedAt: String(course.updated_at ?? indexedAt),
  }
}

export async function purgeTutorIndex(db: any, tenantId: string, courseId: string): Promise<number> {
  const countRow = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM academy_tutor_source_chunks
    WHERE tenant_id=? AND course_id=?
  `).bind(tenantId, courseId).first()
  const removed = Number(countRow?.total ?? 0)
  const now = new Date().toISOString()

  await db.batch([
    db.prepare('DELETE FROM academy_tutor_source_chunks WHERE tenant_id=? AND course_id=?')
      .bind(tenantId, courseId),
    db.prepare(`
      UPDATE academy_tutor_course_policies
      SET last_indexed_at=NULL, last_indexed_course_updated_at=NULL, updated_at=?
      WHERE tenant_id=? AND course_id=?
    `).bind(now, tenantId, courseId),
  ])

  return removed
}
