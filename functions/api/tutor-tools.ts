import { requireTrustedContext } from './_auth'
import { type TutorEvidence } from './_tutor'
import {
  buildTutorLearningArtifact,
  selectTutorLearningEvidence,
  validateTutorLearningArtifact,
  type TutorLearningToolType,
} from './_tutorLearningTools'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const TOOL_TYPES = new Set<TutorLearningToolType>(['summary', 'flashcards', 'practice_exercises'])

function clampFocus(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 300) : ''
}

function citationFromEvidence(item: TutorEvidence) {
  return {
    sourceId: item.id,
    lessonId: item.lessonId,
    lessonTitle: item.sourceTitle,
    sourceType: item.sourceType,
    excerpt: item.text.slice(0, 500),
  }
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const courseId = String(body.courseId ?? '').trim()
  const toolType = String(body.toolType ?? '').trim() as TutorLearningToolType
  const focus = clampFocus(body.focus)
  if (!courseId || !TOOL_TYPES.has(toolType)) {
    return json({ error: 'courseId e toolType válido são obrigatórios' }, 400)
  }

  const enrollment = await db.prepare(`
    SELECT id FROM academy_enrollments
    WHERE tenant_id=? AND student_id=? AND course_id=? AND status IN ('active','completed')
    LIMIT 1
  `).bind(auth.tenantId, auth.userId, courseId).first()
  if (!enrollment) return json({ error: 'Matrícula ativa ou concluída é obrigatória para gerar material de estudo' }, 403)

  const course = await db.prepare(`
    SELECT c.id, c.title, c.status, c.updated_at, p.enabled AS tutor_enabled
    FROM academy_courses c
    LEFT JOIN academy_tutor_course_policies p
      ON p.tenant_id=c.tenant_id AND p.course_id=c.id
    WHERE c.tenant_id=? AND c.id=?
    LIMIT 1
  `).bind(auth.tenantId, courseId).first()
  if (!course || String(course.status) !== 'published') return json({ error: 'Curso não disponível para ferramentas do Tutor' }, 404)
  if (Number(course.tutor_enabled ?? 0) !== 1) return json({ error: 'O Tutor IA não está autorizado para este curso' }, 403)

  const raw = await db.prepare(`
    SELECT id, course_id, lesson_id, source_title, source_type, content_text
    FROM academy_tutor_source_chunks
    WHERE tenant_id=? AND course_id=?
    ORDER BY lesson_id, chunk_index
    LIMIT 300
  `).bind(auth.tenantId, courseId).all()

  const candidates = (raw.results as any[]).map((row) => ({
    id: String(row.id),
    courseId: String(row.course_id),
    lessonId: String(row.lesson_id),
    sourceTitle: String(row.source_title),
    sourceType: String(row.source_type) as TutorEvidence['sourceType'],
    text: String(row.content_text),
  }))
  const evidence = selectTutorLearningEvidence(candidates, focus, toolType === 'summary' ? 8 : 6)
  if (!evidence.length) {
    return json({ error: 'Conteúdo autorizado insuficiente para gerar esta ferramenta de estudo' }, 409)
  }

  let artifact
  try {
    artifact = buildTutorLearningArtifact(toolType, evidence, String(course.title))
  } catch {
    return json({ error: 'Conteúdo autorizado insuficiente para gerar esta ferramenta de estudo' }, 409)
  }

  const validated = validateTutorLearningArtifact(artifact, evidence.map((item) => item.id))
  if (!validated.valid) {
    return json({ error: 'Contrato da ferramenta de estudo inválido', reason: validated.reason }, 500)
  }

  return json({
    data: {
      courseId,
      courseTitle: String(course.title),
      toolType,
      mode: 'evidence_only',
      artifact,
      citations: evidence.map(citationFromEvidence),
      sourceCourseUpdatedAt: String(course.updated_at),
      generatedAt: new Date().toISOString(),
      focusUsed: Boolean(focus),
      officialAssessment: false,
      affectsGrade: false,
      affectsCertificate: false,
      providerAttempted: false,
    },
  })
}
