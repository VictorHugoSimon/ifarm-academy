import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, safeJson, type Env } from './_shared'

const EVIDENCE_TYPES = ['manual', 'checkin_code', 'qr', 'geolocation', 'signature', 'document']

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin', 'academy_instructor'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const eventId = new URL(request.url).searchParams.get('eventId')?.trim() ?? ''
  if (!eventId) return json({ error: 'eventId é obrigatório' }, 400)

  const event = await db.prepare('SELECT * FROM academy_events WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, eventId).first()
  if (!event) return json({ error: 'Evento não encontrado neste tenant' }, 404)

  const result = await db.prepare(`
    SELECT r.*,
      COUNT(ev.id) AS evidence_count,
      MAX(ev.created_at) AS last_evidence_at
    FROM academy_event_registrations r
    LEFT JOIN academy_event_attendance_evidence ev
      ON ev.tenant_id=r.tenant_id AND ev.registration_id=r.id
    WHERE r.tenant_id=? AND r.event_id=?
    GROUP BY r.id
    ORDER BY
      CASE r.status WHEN 'registered' THEN 0 WHEN 'attended' THEN 1 WHEN 'waitlisted' THEN 2 WHEN 'no_show' THEN 3 ELSE 4 END,
      r.display_name_snapshot
  `).bind(auth.tenantId, eventId).all()

  return json({
    event: { id: event.id, title: event.title, startsAt: event.starts_at, endsAt: event.ends_at, status: event.status },
    data: (result.results as any[]).map((row) => ({
      id: row.id,
      eventId: row.event_id,
      userId: row.user_id,
      displayName: row.display_name_snapshot,
      companyId: row.company_id ?? null,
      status: row.status,
      registeredAt: row.registered_at,
      checkinAt: row.checkin_at ?? null,
      checkoutAt: row.checkout_at ?? null,
      evidenceCount: Number(row.evidence_count ?? 0),
      lastEvidenceAt: row.last_evidence_at ?? null,
    })),
  })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin', 'academy_instructor'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const registrationId = String(body.registrationId ?? '').trim()
  const action = String(body.action ?? 'checkin').trim()
  const evidenceType = String(body.evidenceType ?? 'manual').trim()
  const evidence = body.evidence && typeof body.evidence === 'object' ? body.evidence as Record<string, unknown> : {}
  if (!registrationId) return json({ error: 'registrationId é obrigatório' }, 400)
  if (!['checkin', 'checkout', 'no_show'].includes(action)) return json({ error: 'action inválida' }, 400)
  if (action === 'checkin' && !EVIDENCE_TYPES.includes(evidenceType)) return json({ error: 'evidenceType inválido' }, 400)

  const registration = await db.prepare(`
    SELECT r.*, e.title AS event_title, e.status AS event_status, e.starts_at, e.ends_at
    FROM academy_event_registrations r
    JOIN academy_events e ON e.tenant_id=r.tenant_id AND e.id=r.event_id
    WHERE r.tenant_id=? AND r.id=? LIMIT 1
  `).bind(auth.tenantId, registrationId).first()
  if (!registration) return json({ error: 'Inscrição não encontrada neste tenant' }, 404)
  if (String(registration.event_status) === 'cancelled') return json({ error: 'Evento cancelado não aceita presença' }, 409)

  const now = new Date().toISOString()

  if (action === 'checkin') {
    if (String(registration.status) === 'waitlisted') return json({ error: 'Participante em lista de espera não pode fazer check-in' }, 409)
    if (String(registration.status) === 'cancelled') return json({ error: 'Inscrição cancelada não pode fazer check-in' }, 409)
    if (String(registration.status) === 'no_show') return json({ error: 'Ausência já registrada; reverta administrativamente antes do check-in' }, 409)

    const evidenceId = crypto.randomUUID()
    const alreadyAttended = String(registration.status) === 'attended'
    await db.batch([
      db.prepare(`
        UPDATE academy_event_registrations
        SET status='attended',checkin_at=COALESCE(checkin_at,?),updated_at=?
        WHERE tenant_id=? AND id=?
      `).bind(now, now, auth.tenantId, registrationId),
      db.prepare(`
        INSERT INTO academy_event_attendance_evidence (
          id,tenant_id,event_id,registration_id,evidence_type,evidence_json,recorded_by,created_at
        ) VALUES (?,?,?,?,?,?,?,?)
      `).bind(evidenceId, auth.tenantId, registration.event_id, registrationId, evidenceType, JSON.stringify(evidence), auth.userId, now),
      auditStatement(db, auth, {
        action: alreadyAttended ? 'event_attendance.evidence_added' : 'event_attendance.checked_in',
        resourceType: 'event_registration', resourceId: registrationId,
        metadata: { eventId: registration.event_id, userId: registration.user_id, evidenceId, evidenceType },
      }),
    ])
    return json({ data: { registrationId, status: 'attended', checkinAt: registration.checkin_at ?? now, evidenceId, evidenceType } })
  }

  if (action === 'checkout') {
    if (String(registration.status) !== 'attended') return json({ error: 'Checkout exige presença registrada' }, 409)
    if (registration.checkout_at) return json({ data: { registrationId, status: 'attended', checkoutAt: registration.checkout_at }, idempotent: true })
    await db.batch([
      db.prepare('UPDATE academy_event_registrations SET checkout_at=?,updated_at=? WHERE tenant_id=? AND id=?')
        .bind(now, now, auth.tenantId, registrationId),
      auditStatement(db, auth, {
        action: 'event_attendance.checked_out', resourceType: 'event_registration', resourceId: registrationId,
        metadata: { eventId: registration.event_id, userId: registration.user_id },
      }),
    ])
    return json({ data: { registrationId, status: 'attended', checkoutAt: now } })
  }

  if (!['registered', 'waitlisted'].includes(String(registration.status))) {
    return json({ error: 'Somente inscrição registrada ou em espera pode ser marcada como ausência' }, 409)
  }
  await db.batch([
    db.prepare("UPDATE academy_event_registrations SET status='no_show',updated_at=? WHERE tenant_id=? AND id=?")
      .bind(now, auth.tenantId, registrationId),
    auditStatement(db, auth, {
      action: 'event_attendance.no_show', resourceType: 'event_registration', resourceId: registrationId,
      metadata: { eventId: registration.event_id, userId: registration.user_id },
    }),
  ])
  return json({ data: { registrationId, status: 'no_show', updatedAt: now } })
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const registrationId = String(body.registrationId ?? '').trim()
  if (!registrationId) return json({ error: 'registrationId é obrigatório' }, 400)

  const registration = await db.prepare('SELECT * FROM academy_event_registrations WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, registrationId).first()
  if (!registration) return json({ error: 'Inscrição não encontrada neste tenant' }, 404)

  const evidenceRows = await db.prepare(`
    SELECT * FROM academy_event_attendance_evidence
    WHERE tenant_id=? AND registration_id=? ORDER BY created_at
  `).bind(auth.tenantId, registrationId).all()
  return json({ data: {
    registrationId,
    status: registration.status,
    evidence: (evidenceRows.results as any[]).map((row) => ({
      id: row.id,
      evidenceType: row.evidence_type,
      evidence: safeJson(row.evidence_json, {}),
      recordedBy: row.recorded_by,
      createdAt: row.created_at,
    })),
  } })
}
