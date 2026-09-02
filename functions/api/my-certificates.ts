import { requireTrustedContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const result = await db.prepare(`
    SELECT
      id, public_code, course_id, course_title, final_score, issued_at, status,
      workload_minutes, instructor_label, certificate_type, completion_date,
      metadata_version
    FROM academy_certificates
    WHERE tenant_id=? AND student_id=?
    ORDER BY issued_at DESC
  `).bind(context.tenantId, context.userId).all()

  return json({
    data: (result.results as any[]).map((row) => ({
      id: row.id,
      publicCode: row.public_code,
      courseId: row.course_id,
      courseTitle: row.course_title,
      finalScore: row.final_score == null ? null : Number(row.final_score),
      issuedAt: row.issued_at,
      status: row.status,
      workloadMinutes: Number(row.workload_minutes ?? 0),
      instructorLabel: row.instructor_label ?? null,
      certificateType: row.certificate_type ?? 'free_course',
      completionDate: row.completion_date ?? row.issued_at,
      metadataVersion: Number(row.metadata_version ?? 1),
    })),
  })
}
