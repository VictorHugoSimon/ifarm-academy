import { requireTrustedContext } from './_auth'
import { dbOr503, json, type Env } from './_shared'

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const now = new Date().toISOString()
  const result = await db.prepare(`
    SELECT e.*,
      SUM(CASE WHEN r.status IN ('registered','attended') THEN 1 ELSE 0 END) AS occupied,
      SUM(CASE WHEN r.status='waitlisted' THEN 1 ELSE 0 END) AS waitlisted,
      mine.id AS my_registration_id,
      mine.status AS my_registration_status
    FROM academy_events e
    LEFT JOIN academy_event_registrations r
      ON r.tenant_id=e.tenant_id AND r.event_id=e.id
    LEFT JOIN academy_event_registrations mine
      ON mine.tenant_id=e.tenant_id AND mine.event_id=e.id AND mine.user_id=?
    WHERE e.tenant_id=? AND e.status='published' AND datetime(e.ends_at) >= datetime(?)
    GROUP BY e.id
    ORDER BY e.starts_at
  `).bind(auth.userId, auth.tenantId, now).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    modality: row.modality,
    accessModel: row.access_model,
    priceCents: row.price_cents == null ? null : Number(row.price_cents),
    currency: row.currency,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    registrationDeadline: row.registration_deadline ?? null,
    capacity: row.capacity == null ? null : Number(row.capacity),
    venueName: row.venue_name ?? null,
    addressText: row.address_text ?? null,
    meetingUrl: row.meeting_url ?? null,
    smartFarmExperience: Number(row.smart_farm_experience) === 1,
    occupied: Number(row.occupied ?? 0),
    waitlisted: Number(row.waitlisted ?? 0),
    myRegistrationId: row.my_registration_id ?? null,
    myRegistrationStatus: row.my_registration_status ?? null,
  })) })
}
