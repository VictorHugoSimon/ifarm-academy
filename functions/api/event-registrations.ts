import { auditStatement } from './_audit'
import { requireTrustedContext } from './_auth'
import { decideEventRegistration } from './_eventRules'
import { bodyJson, dbOr503, json, type Env } from './_shared'

async function occupancy(db: any, tenantId: string, eventId: string): Promise<number> {
  const row = await db.prepare(`
    SELECT COUNT(*) AS total FROM academy_event_registrations
    WHERE tenant_id=? AND event_id=? AND status IN ('registered','attended')
  `).bind(tenantId, eventId).first()
  return Number(row?.total ?? 0)
}

async function promoteWaitlist(db: any, tenantId: string, eventId: string, now: string) {
  const event = await db.prepare('SELECT capacity FROM academy_events WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(tenantId, eventId).first()
  if (!event || event.capacity == null) return null
  if (await occupancy(db, tenantId, eventId) >= Number(event.capacity)) return null

  const waiting = await db.prepare(`
    SELECT * FROM academy_event_registrations
    WHERE tenant_id=? AND event_id=? AND status='waitlisted'
    ORDER BY registered_at LIMIT 1
  `).bind(tenantId, eventId).first()
  if (!waiting) return null

  await db.prepare(`
    UPDATE academy_event_registrations
    SET status='registered', updated_at=?
    WHERE tenant_id=? AND id=? AND status='waitlisted'
  `).bind(now, tenantId, waiting.id).run()
  return waiting
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const result = await db.prepare(`
    SELECT r.*, e.title, e.event_type, e.modality, e.access_model, e.starts_at, e.ends_at,
      e.venue_name, e.address_text, e.meeting_url, e.smart_farm_experience
    FROM academy_event_registrations r
    JOIN academy_events e ON e.tenant_id=r.tenant_id AND e.id=r.event_id
    WHERE r.tenant_id=? AND r.user_id=?
    ORDER BY e.starts_at DESC
  `).bind(auth.tenantId, auth.userId).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    eventType: row.event_type,
    modality: row.modality,
    accessModel: row.access_model,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    venueName: row.venue_name ?? null,
    addressText: row.address_text ?? null,
    meetingUrl: row.meeting_url ?? null,
    smartFarmExperience: Number(row.smart_farm_experience) === 1,
    status: row.status,
    companyId: row.company_id ?? null,
    marketingConsent: Number(row.marketing_consent) === 1,
    registeredAt: row.registered_at,
    checkinAt: row.checkin_at ?? null,
    checkoutAt: row.checkout_at ?? null,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const eventId = String(body.eventId ?? '').trim()
  const companyId = String(body.companyId ?? '').trim() || null
  const marketingConsent = body.marketingConsent === true
  if (!eventId) return json({ error: 'eventId é obrigatório' }, 400)

  const event = await db.prepare('SELECT * FROM academy_events WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, eventId).first()
  if (!event) return json({ error: 'Evento não encontrado neste tenant' }, 404)

  if (companyId) {
    const company = await db.prepare('SELECT id FROM academy_companies WHERE tenant_id=? AND id=? LIMIT 1')
      .bind(auth.tenantId, companyId).first()
    if (!company) return json({ error: 'Empresa não encontrada neste tenant' }, 404)
  }

  const existing = await db.prepare(`
    SELECT * FROM academy_event_registrations
    WHERE tenant_id=? AND event_id=? AND user_id=? LIMIT 1
  `).bind(auth.tenantId, eventId, auth.userId).first()
  if (existing && String(existing.status) !== 'cancelled') {
    return json({ data: { id: existing.id, eventId, status: existing.status }, idempotent: true })
  }

  const occupied = await occupancy(db, auth.tenantId, eventId)
  const decision = decideEventRegistration({
    status: String(event.status),
    accessModel: String(event.access_model),
    endsAt: String(event.ends_at),
    registrationDeadline: event.registration_deadline == null ? null : String(event.registration_deadline),
    capacity: event.capacity == null ? null : Number(event.capacity),
    occupied,
  })
  if (!decision.allowed) {
    if (decision.reason === 'checkout_required') return json({ error: 'Evento pago exige checkout antes da inscrição', checkoutRequired: true, eventId }, 409)
    if (decision.reason === 'registration_closed') return json({ error: 'Prazo de inscrição encerrado' }, 409)
    if (decision.reason === 'event_ended') return json({ error: 'Evento já encerrado' }, 409)
    return json({ error: 'Evento não está aberto para inscrições' }, 409)
  }

  const status = decision.status
  const timestamp = new Date().toISOString()
  const id = existing ? String(existing.id) : crypto.randomUUID()
  const action = existing ? 'event_registration.reactivated' : 'event_registration.created'

  await db.batch([
    db.prepare(`
      INSERT INTO academy_event_registrations (
        id,tenant_id,event_id,user_id,display_name_snapshot,company_id,status,source,
        marketing_consent,registered_at,cancelled_at,checkin_at,checkout_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,'academy',?,?,NULL,NULL,NULL,?)
      ON CONFLICT(tenant_id,event_id,user_id) DO UPDATE SET
        display_name_snapshot=excluded.display_name_snapshot,
        company_id=excluded.company_id,
        status=excluded.status,
        marketing_consent=excluded.marketing_consent,
        registered_at=excluded.registered_at,
        cancelled_at=NULL,
        checkin_at=NULL,
        checkout_at=NULL,
        updated_at=excluded.updated_at
    `).bind(
      id, auth.tenantId, eventId, auth.userId, auth.displayName ?? auth.userId,
      companyId, status, marketingConsent ? 1 : 0, timestamp, timestamp,
    ),
    auditStatement(db, auth, {
      action, resourceType: 'event_registration', resourceId: id,
      metadata: { eventId, eventTitle: event.title, status, companyId, marketingConsent, occupiedBefore: occupied },
    }),
  ])

  return json({ data: { id, eventId, status, waitlisted: status === 'waitlisted', registeredAt: timestamp } }, existing ? 200 : 201)
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const eventId = new URL(request.url).searchParams.get('eventId')?.trim() ?? ''
  if (!eventId) return json({ error: 'eventId é obrigatório' }, 400)

  const existing = await db.prepare(`
    SELECT * FROM academy_event_registrations
    WHERE tenant_id=? AND event_id=? AND user_id=? LIMIT 1
  `).bind(auth.tenantId, eventId, auth.userId).first()
  if (!existing) return json({ error: 'Inscrição não encontrada' }, 404)
  if (String(existing.status) === 'cancelled') return json({ data: { id: existing.id, status: 'cancelled' }, idempotent: true })
  if (String(existing.status) === 'attended') return json({ error: 'Presença já registrada não pode ser cancelada pelo participante' }, 409)

  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`
      UPDATE academy_event_registrations
      SET status='cancelled',cancelled_at=?,updated_at=?
      WHERE tenant_id=? AND id=?
    `).bind(now, now, auth.tenantId, existing.id),
    auditStatement(db, auth, {
      action: 'event_registration.cancelled', resourceType: 'event_registration', resourceId: String(existing.id),
      metadata: { eventId, previousStatus: existing.status },
    }),
  ])

  const promoted = String(existing.status) === 'registered'
    ? await promoteWaitlist(db, auth.tenantId, eventId, now)
    : null

  return json({ data: {
    id: existing.id,
    eventId,
    status: 'cancelled',
    promotedRegistrationId: promoted?.id ?? null,
    updatedAt: now,
  } })
}
