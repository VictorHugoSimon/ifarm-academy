import { requireTrustedContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const context = requireTrustedContext(env, request)
  if (context instanceof Response) return context
  const db = dbOr503(env); if (db instanceof Response) return db

  const result = await db.prepare(`
    SELECT
      cert.id, cert.cycle_id, cert.public_code, cert.course_id, cert.course_title,
      cert.final_score, cert.issued_at, cert.status, cert.workload_minutes,
      cert.instructor_label, cert.certificate_type, cert.completion_date,
      cert.metadata_version, lc.cycle_number
    FROM academy_certificates cert
    LEFT JOIN academy_learning_cycles lc
      ON lc.tenant_id=cert.tenant_id AND lc.id=cert.cycle_id
    WHERE cert.tenant_id=? AND cert.student_id=?
    ORDER BY cert.issued_at DESC
  `).bind(context.tenantId, context.userId).all()

  return json({
    data: (result.results as any[]).map((row) => ({
      id: row.id,
      cycleId: row.cycle_id,
      cycleNumber: row.cycle_number == null ? null : Number(row.cycle_number),
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
