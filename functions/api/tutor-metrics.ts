import { requireAdminContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

const allowedRoles = ['academy_admin', 'ifarm_admin']

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, allowedRoles)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const sessionsRow = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM academy_tutor_sessions
    WHERE tenant_id=?
  `).bind(auth.tenantId).first()

  const messagesRow = await db.prepare(`
    SELECT
      SUM(CASE WHEN role='user' THEN 1 ELSE 0 END) AS questions,
      SUM(CASE WHEN role='assistant' THEN 1 ELSE 0 END) AS responses,
      SUM(CASE WHEN role='assistant' AND mode='evidence_only' THEN 1 ELSE 0 END) AS evidence_only,
      SUM(CASE WHEN role='assistant' AND mode='insufficient_context' THEN 1 ELSE 0 END) AS insufficient_context
    FROM academy_tutor_messages
    WHERE tenant_id=?
  `).bind(auth.tenantId).first()

  const feedbackRow = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN rating='helpful' THEN 1 ELSE 0 END) AS helpful,
      SUM(CASE WHEN rating='not_helpful' THEN 1 ELSE 0 END) AS not_helpful
    FROM academy_tutor_feedback
    WHERE tenant_id=?
  `).bind(auth.tenantId).first()

  const courseRows = await db.prepare(`
    SELECT
      s.course_id AS course_id,
      COALESCE(c.title, s.course_id) AS course_title,
      COUNT(DISTINCT s.id) AS sessions,
      SUM(CASE WHEN m.role='user' THEN 1 ELSE 0 END) AS questions,
      SUM(CASE WHEN m.role='assistant' THEN 1 ELSE 0 END) AS responses,
      SUM(CASE WHEN m.role='assistant' AND m.mode='insufficient_context' THEN 1 ELSE 0 END) AS insufficient_context,
      SUM(CASE WHEN f.rating='helpful' THEN 1 ELSE 0 END) AS helpful,
      SUM(CASE WHEN f.rating='not_helpful' THEN 1 ELSE 0 END) AS not_helpful,
      COUNT(f.id) AS feedback_count
    FROM academy_tutor_sessions s
    LEFT JOIN academy_courses c
      ON c.tenant_id=s.tenant_id AND c.id=s.course_id
    LEFT JOIN academy_tutor_messages m
      ON m.tenant_id=s.tenant_id AND m.session_id=s.id
    LEFT JOIN academy_tutor_feedback f
      ON f.tenant_id=m.tenant_id AND f.message_id=m.id
    WHERE s.tenant_id=?
    GROUP BY s.course_id, c.title
    ORDER BY insufficient_context DESC, questions DESC, course_title
    LIMIT 50
  `).bind(auth.tenantId).all()

  const reasons = await db.prepare(`
    SELECT reason, COUNT(*) AS total
    FROM academy_tutor_feedback
    WHERE tenant_id=? AND reason IS NOT NULL
    GROUP BY reason
    ORDER BY total DESC, reason
  `).bind(auth.tenantId).all()

  const sessions = Number(sessionsRow?.total ?? 0)
  const questions = Number(messagesRow?.questions ?? 0)
  const responses = Number(messagesRow?.responses ?? 0)
  const evidenceOnly = Number(messagesRow?.evidence_only ?? 0)
  const insufficientContext = Number(messagesRow?.insufficient_context ?? 0)
  const feedbackTotal = Number(feedbackRow?.total ?? 0)
  const helpful = Number(feedbackRow?.helpful ?? 0)
  const notHelpful = Number(feedbackRow?.not_helpful ?? 0)

  return json({ data: {
    totals: {
      sessions,
      questions,
      responses,
      evidenceOnly,
      insufficientContext,
      insufficientContextRate: percent(insufficientContext, responses),
      feedbackTotal,
      helpful,
      notHelpful,
      helpfulRate: percent(helpful, feedbackTotal),
    },
    courses: (courseRows.results as any[]).map((row) => {
      const rowResponses = Number(row.responses ?? 0)
      const rowFeedback = Number(row.feedback_count ?? 0)
      const rowHelpful = Number(row.helpful ?? 0)
      const rowInsufficient = Number(row.insufficient_context ?? 0)
      return {
        courseId: row.course_id,
        courseTitle: row.course_title,
        sessions: Number(row.sessions ?? 0),
        questions: Number(row.questions ?? 0),
        responses: rowResponses,
        insufficientContext: rowInsufficient,
        insufficientContextRate: percent(rowInsufficient, rowResponses),
        feedbackCount: rowFeedback,
        helpful: rowHelpful,
        notHelpful: Number(row.not_helpful ?? 0),
        helpfulRate: percent(rowHelpful, rowFeedback),
      }
    }),
    reasons: reasons.results,
    privacy: {
      scope: 'aggregated_by_course',
      rawQuestionsExposed: false,
      learnerRankingEnabled: false,
      commercialProfilingEnabled: false,
    },
  }})
}
