import { requireTrustedContext } from './_auth'
import { evidenceOnlyMessage, scoreTutorEvidence, type TutorEvidence } from './_tutor'
import { buildTutorProviderEnvelope, runTutorProvider, tutorProviderRuntimeStatus, type TutorProviderResult } from './_tutorProvider'
import { assessTutorPromptRisk } from './_tutorSafety'
import {
  finalizeTutorUsageReservationStatement,
  reserveTutorUsage,
  type TutorQuotaBlockReason,
} from './_tutorQuota'
import { bodyJson, dbOr503, json, type Env } from './_shared'

function clampQuestion(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 2000) : ''
}

function citationFromEvidence(item: TutorEvidence) {
  return {
    chunkId: item.id,
    lessonId: item.lessonId,
    lessonTitle: item.sourceTitle,
    sourceType: item.sourceType,
    excerpt: item.text.slice(0, 700),
    score: item.score,
  }
}

function citedEvidence(evidence: TutorEvidence[], citationIds: string[]): TutorEvidence[] {
  return citationIds
    .map((id) => {
      const index = Number(id.replace(/^S/, '')) - 1
      return Number.isInteger(index) && index >= 0 ? evidence[index] : undefined
    })
    .filter((item): item is TutorEvidence => Boolean(item))
}

type TutorProviderBlockReason = 'prompt_risk' | TutorQuotaBlockReason

type GuardrailDraft = {
  eventType: 'prompt_risk' | 'quota_block'
  reasonCode: string
  riskFlags: string[]
  policyId?: string | null
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const sessions = await db.prepare(`
    SELECT id, course_id, title, status, created_at, updated_at
    FROM academy_tutor_sessions
    WHERE tenant_id=? AND student_id=?
    ORDER BY updated_at DESC
    LIMIT 30
  `).bind(auth.tenantId, auth.userId).all()

  return json({ data: sessions.results })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const courseId = String(body.courseId ?? '').trim()
  const question = clampQuestion(body.question)
  const requestedSessionId = String(body.sessionId ?? '').trim()
  const externalGenerationRequested = body.allowExternalGeneration === true
  if (!courseId || question.length < 3) return json({ error: 'courseId e question são obrigatórios' }, 400)

  const enrollment = await db.prepare(`
    SELECT id, status FROM academy_enrollments
    WHERE tenant_id=? AND student_id=? AND course_id=? AND status IN ('active','completed')
    LIMIT 1
  `).bind(auth.tenantId, auth.userId, courseId).first()
  if (!enrollment) return json({ error: 'Matrícula ativa ou concluída é obrigatória para usar o Tutor neste curso' }, 403)

  const course = await db.prepare(`
    SELECT c.id, c.title, c.status, c.updated_at,
           p.enabled AS tutor_enabled,
           p.generative_enabled,
           p.generative_approved_course_updated_at
    FROM academy_courses c
    LEFT JOIN academy_tutor_course_policies p
      ON p.tenant_id=c.tenant_id AND p.course_id=c.id
    WHERE c.tenant_id=? AND c.id=?
    LIMIT 1
  `).bind(auth.tenantId, courseId).first()
  if (!course || String(course.status) !== 'published') return json({ error: 'Curso não disponível para o Tutor' }, 404)
  if (Number(course.tutor_enabled ?? 0) !== 1) {
    return json({ error: 'O Tutor IA não está autorizado para este curso' }, 403)
  }

  const generativeAuthorized = Number(course.generative_enabled ?? 0) === 1
    && Boolean(course.generative_approved_course_updated_at)
    && String(course.generative_approved_course_updated_at) === String(course.updated_at)

  let sessionId = requestedSessionId
  if (sessionId) {
    const existing = await db.prepare(`
      SELECT id FROM academy_tutor_sessions
      WHERE id=? AND tenant_id=? AND student_id=? AND course_id=? AND status='active'
      LIMIT 1
    `).bind(sessionId, auth.tenantId, auth.userId, courseId).first()
    if (!existing) return json({ error: 'Sessão do Tutor inválida para este aluno/curso' }, 404)
  } else {
    sessionId = crypto.randomUUID()
  }

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
  const evidence = scoreTutorEvidence(question, candidates).slice(0, 5)
  const fallback = evidenceOnlyMessage(evidence)
  const runtime = tutorProviderRuntimeStatus(env)

  let providerResult: TutorProviderResult | null = null
  let answerMode: 'evidence_only' | 'insufficient_context' | 'provider_generated' = fallback.mode
  let answerText = fallback.text
  let answerEvidence = evidence
  let provider: string | null = null
  let providerBlockedReason: TutorProviderBlockReason | null = null
  let reservationId: string | null = null
  let guardrail: GuardrailDraft | null = null

  if (externalGenerationRequested && generativeAuthorized && evidence.length > 0) {
    const risk = assessTutorPromptRisk(question, evidence)
    if (risk.blockProvider) {
      providerBlockedReason = 'prompt_risk'
      guardrail = {
        eventType: 'prompt_risk',
        reasonCode: 'external_generation_prompt_risk',
        riskFlags: risk.flags,
      }
    } else if (runtime.configured) {
      const projectedRequestChars = JSON.stringify(buildTutorProviderEnvelope(question, evidence)).length
      const quota = await reserveTutorUsage(db, {
        tenantId: auth.tenantId,
        courseId,
        studentId: auth.userId,
        projectedRequestChars,
      })
      if (!quota.allowed || !quota.reservationId) {
        providerBlockedReason = quota.reason ?? 'quota_concurrency_block'
        guardrail = {
          eventType: 'quota_block',
          reasonCode: providerBlockedReason,
          riskFlags: [],
          policyId: quota.blockedPolicy?.policy.id ?? null,
        }
      } else {
        reservationId = quota.reservationId
        providerResult = await runTutorProvider(env, question, evidence)
      }
    } else {
      // Mantém a telemetria de configuração da v0.58 sem criar reserva/custo,
      // pois nenhuma chamada externa é realizada quando o runtime não está configurado.
      providerResult = await runTutorProvider(env, question, evidence)
    }

    if (providerResult?.outcome === 'success' && providerResult.answer) {
      answerMode = 'provider_generated'
      answerText = providerResult.answer
      answerEvidence = citedEvidence(evidence, providerResult.citationIds)
      provider = runtime.mode
    }
  }

  const now = new Date().toISOString()
  const citations = answerEvidence.map(citationFromEvidence)
  const statements: any[] = []
  if (!requestedSessionId) {
    statements.push(db.prepare(`
      INSERT INTO academy_tutor_sessions (
        id, tenant_id, student_id, course_id, title, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(sessionId, auth.tenantId, auth.userId, courseId, question.slice(0, 120), now, now))
  } else {
    statements.push(db.prepare('UPDATE academy_tutor_sessions SET updated_at=? WHERE id=? AND tenant_id=? AND student_id=?')
      .bind(now, sessionId, auth.tenantId, auth.userId))
  }

  statements.push(
    db.prepare(`
      INSERT INTO academy_tutor_messages (
        id, tenant_id, session_id, student_id, role, mode, content_text, citations_json, provider, created_at
      ) VALUES (?, ?, ?, ?, 'user', 'user_input', ?, '[]', NULL, ?)
    `).bind(crypto.randomUUID(), auth.tenantId, sessionId, auth.userId, question, now),
    db.prepare(`
      INSERT INTO academy_tutor_messages (
        id, tenant_id, session_id, student_id, role, mode, content_text, citations_json, provider, created_at
      ) VALUES (?, ?, ?, ?, 'assistant', ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), auth.tenantId, sessionId, auth.userId, answerMode, answerText, JSON.stringify(citations), provider, now),
  )

  if (reservationId) {
    statements.push(finalizeTutorUsageReservationStatement(
      db,
      reservationId,
      providerResult?.attempted ? 'consumed' : 'released',
      now,
    ))
  }

  if (providerResult) {
    statements.push(db.prepare(`
      INSERT INTO academy_tutor_provider_events (
        id, tenant_id, session_id, student_id, course_id, provider_mode, outcome,
        latency_ms, evidence_count, citation_count, request_chars, response_chars,
        fallback_reason, created_at, reservation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      auth.tenantId,
      sessionId,
      auth.userId,
      courseId,
      runtime.mode,
      providerResult.outcome,
      providerResult.latencyMs,
      evidence.length,
      providerResult.citationIds.length,
      providerResult.requestChars,
      providerResult.responseChars,
      providerResult.fallbackReason ?? null,
      now,
      providerResult.outcome === 'config_error' ? null : reservationId,
    ))
  }

  if (guardrail) {
    statements.push(db.prepare(`
      INSERT INTO academy_tutor_guardrail_events (
        id, tenant_id, session_id, student_id, course_id, event_type,
        reason_code, risk_flags_json, policy_id, provider_blocked,
        question_chars, evidence_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      auth.tenantId,
      sessionId,
      auth.userId,
      courseId,
      guardrail.eventType,
      guardrail.reasonCode,
      JSON.stringify(guardrail.riskFlags),
      guardrail.policyId ?? null,
      question.length,
      evidence.length,
      now,
    ))
  }

  await db.batch(statements)
  return json({
    data: {
      sessionId,
      courseId,
      courseTitle: course.title,
      mode: answerMode,
      answer: answerText,
      citations,
      providerConfigured: runtime.configured,
      providerMode: runtime.mode,
      providerAttempted: providerResult?.attempted ?? false,
      providerOutcome: providerResult?.outcome ?? null,
      providerBlockedReason,
      generativeAuthorized,
      externalGenerationRequested,
      fallbackUsed: Boolean(providerBlockedReason || (providerResult && providerResult.outcome !== 'success')),
    },
  })
}
