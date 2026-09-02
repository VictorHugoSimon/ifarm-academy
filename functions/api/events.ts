import { auditStatement } from './_audit'
import { requireAdminContext } from './_auth'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const EVENT_TYPES = ['workshop', 'field_day', 'practical_class', 'training', 'webinar', 'other']
const MODALITIES = ['in_person', 'online', 'hybrid']
const ACCESS_MODELS = ['free', 'paid', 'sponsored']
const STATUSES = ['draft', 'published', 'completed', 'cancelled']

function optionalText(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text || null
}

function parseDate(value: unknown): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function parseEventInput(body: Record<string, unknown>, existing?: any) {
  const title = String(body.title ?? existing?.title ?? '').trim()
  const description = String(body.description ?? existing?.description ?? '').trim()
  const eventType = String(body.eventType ?? existing?.event_type ?? 'other').trim()
  const modality = String(body.modality ?? existing?.modality ?? 'in_person').trim()
  const accessModel = String(body.accessModel ?? existing?.access_model ?? 'free').trim()
  const status = String(body.status ?? existing?.status ?? 'draft').trim()
  const startsAt = parseDate(body.startsAt ?? existing?.starts_at)
  const endsAt = parseDate(body.endsAt ?? existing?.ends_at)
  const registrationDeadlineRaw = body.registrationDeadline === null ? null : body.registrationDeadline ?? existing?.registration_deadline
  const registrationDeadline = registrationDeadlineRaw ? parseDate(registrationDeadlineRaw) : null
  const capacityRaw = body.capacity === null || body.capacity === '' ? null : body.capacity ?? existing?.capacity
  const capacity = capacityRaw == null ? null : Number(capacityRaw)
  const priceRaw = body.priceCents === null || body.priceCents === '' ? null : body.priceCents ?? existing?.price_cents
  const priceCents = priceRaw == null ? null : Number(priceRaw)
  const smartFarmExperience = body.smartFarmExperience == null
    ? Number(existing?.smart_farm_experience ?? 0) === 1
    : body.smartFarmExperience === true

  if (!title) return { error: 'title é obrigatório' } as const
  if (!EVENT_TYPES.includes(eventType)) return { error: 'eventType inválido' } as const
  if (!MODALITIES.includes(modality)) return { error: 'modality inválida' } as const
  if (!ACCESS_MODELS.includes(accessModel)) return { error: 'accessModel inválido' } as const
  if (!STATUSES.includes(status)) return { error: 'status inválido' } as const
  if (!startsAt || !endsAt) return { error: 'startsAt e endsAt válidos são obrigatórios' } as const
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return { error: 'endsAt deve ser posterior a startsAt' } as const
  if (registrationDeadline && new Date(registrationDeadline).getTime() > new Date(startsAt).getTime()) {
    return { error: 'registrationDeadline não pode ser posterior ao início do evento' } as const
  }
  if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) return { error: 'capacity deve ser inteiro maior que zero' } as const
  if (priceCents != null && (!Number.isInteger(priceCents) || priceCents < 0)) return { error: 'priceCents deve ser inteiro não negativo' } as const
  if (accessModel === 'paid' && (!priceCents || priceCents < 1)) return { error: 'Evento pago exige priceCents maior que zero' } as const
  if (accessModel !== 'paid' && priceCents != null && priceCents > 0) return { error: 'Preço só pode ser informado para evento pago' } as const

  return { data: {
    title,
    description,
    eventType,
    modality,
    accessModel,
    status,
    startsAt,
    endsAt,
    registrationDeadline,
    capacity,
    priceCents,
    currency: String(body.currency ?? existing?.currency ?? 'BRL').trim().toUpperCase() || 'BRL',
    timezone: String(body.timezone ?? existing?.timezone ?? 'America/Sao_Paulo').trim() || 'America/Sao_Paulo',
    venueName: optionalText(body.venueName ?? existing?.venue_name),
    addressText: optionalText(body.addressText ?? existing?.address_text),
    meetingUrl: optionalText(body.meetingUrl ?? existing?.meeting_url),
    smartFarmExperience,
  }} as const
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db

  const status = new URL(request.url).searchParams.get('status')?.trim() ?? ''
  if (status && !STATUSES.includes(status)) return json({ error: 'status inválido' }, 400)

  const result = await db.prepare(`
    SELECT e.*,
      SUM(CASE WHEN r.status IN ('registered','attended') THEN 1 ELSE 0 END) AS occupied,
      SUM(CASE WHEN r.status='waitlisted' THEN 1 ELSE 0 END) AS waitlisted,
      SUM(CASE WHEN r.status='attended' THEN 1 ELSE 0 END) AS attended
    FROM academy_events e
    LEFT JOIN academy_event_registrations r
      ON r.tenant_id=e.tenant_id AND r.event_id=e.id
    WHERE e.tenant_id=? AND (?='' OR e.status=?)
    GROUP BY e.id
    ORDER BY e.starts_at DESC
  `).bind(auth.tenantId, status, status).all()

  return json({ data: (result.results as any[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    modality: row.modality,
    status: row.status,
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
    attended: Number(row.attended ?? 0),
    publishedAt: row.published_at ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const parsed = parseEventInput(body)
  if ('error' in parsed) return json({ error: parsed.error }, 400)
  const event = parsed.data
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const publishedAt = event.status === 'published' ? now : null
  const completedAt = event.status === 'completed' ? now : null

  await db.batch([
    db.prepare(`
      INSERT INTO academy_events (
        id,tenant_id,title,description,event_type,modality,status,access_model,
        price_cents,currency,starts_at,ends_at,timezone,registration_deadline,
        capacity,venue_name,address_text,meeting_url,smart_farm_experience,
        created_by,published_at,completed_at,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, auth.tenantId, event.title, event.description, event.eventType, event.modality,
      event.status, event.accessModel, event.priceCents, event.currency, event.startsAt,
      event.endsAt, event.timezone, event.registrationDeadline, event.capacity,
      event.venueName, event.addressText, event.meetingUrl, event.smartFarmExperience ? 1 : 0,
      auth.userId, publishedAt, completedAt, now, now,
    ),
    auditStatement(db, auth, {
      action: 'event.created', resourceType: 'event', resourceId: id,
      metadata: { title: event.title, eventType: event.eventType, modality: event.modality, accessModel: event.accessModel, status: event.status, smartFarmExperience: event.smartFarmExperience },
    }),
  ])

  return json({ data: { id, ...event, publishedAt, completedAt, createdAt: now, updatedAt: now } }, 201)
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const eventId = String(body.eventId ?? '').trim()
  if (!eventId) return json({ error: 'eventId é obrigatório' }, 400)

  const existing = await db.prepare('SELECT * FROM academy_events WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, eventId).first()
  if (!existing) return json({ error: 'Evento não encontrado neste tenant' }, 404)

  const parsed = parseEventInput(body, existing)
  if ('error' in parsed) return json({ error: parsed.error }, 400)
  const event = parsed.data
  const now = new Date().toISOString()
  const publishedAt = event.status === 'published' ? existing.published_at ?? now : existing.published_at ?? null
  const completedAt = event.status === 'completed' ? existing.completed_at ?? now : existing.completed_at ?? null

  await db.batch([
    db.prepare(`
      UPDATE academy_events SET
        title=?,description=?,event_type=?,modality=?,status=?,access_model=?,price_cents=?,currency=?,
        starts_at=?,ends_at=?,timezone=?,registration_deadline=?,capacity=?,venue_name=?,address_text=?,
        meeting_url=?,smart_farm_experience=?,published_at=?,completed_at=?,updated_at=?
      WHERE tenant_id=? AND id=?
    `).bind(
      event.title, event.description, event.eventType, event.modality, event.status,
      event.accessModel, event.priceCents, event.currency, event.startsAt, event.endsAt,
      event.timezone, event.registrationDeadline, event.capacity, event.venueName,
      event.addressText, event.meetingUrl, event.smartFarmExperience ? 1 : 0,
      publishedAt, completedAt, now, auth.tenantId, eventId,
    ),
    auditStatement(db, auth, {
      action: 'event.updated', resourceType: 'event', resourceId: eventId,
      metadata: { previousStatus: existing.status, status: event.status, title: event.title },
    }),
  ])

  return json({ data: { id: eventId, ...event, publishedAt, completedAt, updatedAt: now } })
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin', 'ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const eventId = new URL(request.url).searchParams.get('eventId')?.trim() ?? ''
  if (!eventId) return json({ error: 'eventId é obrigatório' }, 400)

  const existing = await db.prepare('SELECT * FROM academy_events WHERE tenant_id=? AND id=? LIMIT 1')
    .bind(auth.tenantId, eventId).first()
  if (!existing) return json({ error: 'Evento não encontrado neste tenant' }, 404)
  if (String(existing.status) === 'cancelled') return json({ data: { id: eventId, status: 'cancelled' }, idempotent: true })

  const now = new Date().toISOString()
  await db.batch([
    db.prepare("UPDATE academy_events SET status='cancelled',updated_at=? WHERE tenant_id=? AND id=?")
      .bind(now, auth.tenantId, eventId),
    db.prepare("UPDATE academy_event_registrations SET status='cancelled',cancelled_at=?,updated_at=? WHERE tenant_id=? AND event_id=? AND status IN ('registered','waitlisted')")
      .bind(now, now, auth.tenantId, eventId),
    auditStatement(db, auth, { action: 'event.cancelled', resourceType: 'event', resourceId: eventId, metadata: { title: existing.title } }),
  ])
  return json({ data: { id: eventId, status: 'cancelled', updatedAt: now } })
}
