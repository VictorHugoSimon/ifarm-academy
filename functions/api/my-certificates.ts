import { requireTrustedContext } from './_auth'
import { certificateEffectiveStatus } from './_certificateValidity'
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
      cert.metadata_version, cert.validity_mode, cert.validity_policy_version,
      cert.valid_until, lc.cycle_number
    FROM academy_certificates cert
    LEFT JOIN academy_learning_cycles lc
      ON lc.tenant_id=cert.tenant_id AND lc.id=cert.cycle_id
    WHERE cert.tenant_id=? AND cert.student_id=?
    ORDER BY cert.issued_at DESC
  `).bind(context.tenantId, context.userId).all()

  return json({
    data: (result.results as any[]).map((row) => {
      const effectiveStatus = certificateEffectiveStatus(
        String(row.status),
        row.valid_until == null ? null : String(row.valid_until),
      )
      const validityMode = String(row.validity_mode ?? 'not_configured')
      return {
        id: row.id,
        cycleId: row.cycle_id,
        cycleNumber: row.cycle_number == null ? null : Number(row.cycle_number),
        publicCode: row.public_code,
        courseId: row.course_id,
        courseTitle: row.course_title,
        finalScore: row.final_score == null ? null : Number(row.final_score),
        issuedAt: row.issued_at,
        status: row.status,
        effectiveStatus,
        workloadMinutes: Number(row.workload_minutes ?? 0),
        instructorLabel: row.instructor_label ?? null,
        certificateType: row.certificate_type ?? 'free_course',
        completionDate: row.completion_date ?? row.issued_at,
        metadataVersion: Number(row.metadata_version ?? 1),
        validityMode,
        validityPolicyVersion: row.validity_policy_version == null ? null : Number(row.validity_policy_version),
        validUntil: row.valid_until ?? null,
        validityPolicyConfigured: validityMode !== 'not_configured',
      }
    }),
  })
}
