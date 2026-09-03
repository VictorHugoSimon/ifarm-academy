import { auditStatement } from './_audit'
import { requireAdminContext, requireTrustedContext } from './_auth'
import { isInterestCode } from './_smartFarm'
import { bodyJson, dbOr503, json, type Env } from './_shared'

const ACTIVITY_TYPES = ['field_activity','demonstration','lecture','visit','break','other']

function parseDate(value: unknown): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const onRequestGet = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireTrustedContext(env, request)
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const eventId = new URL(request.url).searchParams.get('eventId')?.trim() ?? ''
  if (!eventId) return json({ error: 'eventId é obrigatório' }, 400)

  const event = await db.prepare(`
    SELECT id,title,status,smart_farm_experience,starts_at,ends_at,venue_name,address_text
    FROM academy_events WHERE tenant_id=? AND id=? LIMIT 1
  `).bind(auth.tenantId, eventId).first()
  if (!event || Number(event.smart_farm_experience) !== 1) return json({ error: 'Smart Farm Experience não encontrada' }, 404)

  const isAdmin = auth.roles.some((role) => ['academy_admin','ifarm_admin'].includes(role))
  if (!isAdmin && String(event.status) !== 'published') return json({ error: 'Agenda ainda não publicada' }, 404)

  const items = await db.prepare(`
    SELECT * FROM academy_smart_farm_agenda_items
    WHERE tenant_id=? AND event_id=?
    ORDER BY position, starts_at, created_at
  `).bind(auth.tenantId, eventId).all()

  return json({
    event: {
      id: event.id,
      title: event.title,
      status: event.status,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      venueName: event.venue_name ?? null,
      addressText: event.address_text ?? null,
    },
    data: (items.results as any[]).map((row) => ({
      id: row.id,
      eventId: row.event_id,
      title: row.title,
      description: row.description,
      activityType: row.activity_type,
      startsAt: row.starts_at ?? null,
      endsAt: row.ends_at ?? null,
      position: Number(row.position ?? 0),
      locationLabel: row.location_label ?? null,
      requiresPracticalEvidence: Number(row.requires_practical_evidence) === 1,
      interestCode: row.interest_code ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  })
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }

  const eventId = String(body.eventId ?? '').trim()
  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const activityType = String(body.activityType ?? 'field_activity').trim()
  const startsAt = body.startsAt ? parseDate(body.startsAt) : null
  const endsAt = body.endsAt ? parseDate(body.endsAt) : null
  const position = Math.max(0, Number(body.position ?? 0))
  const locationLabel = String(body.locationLabel ?? '').trim() || null
  const requiresPracticalEvidence = body.requiresPracticalEvidence === true
  const interestCode = String(body.interestCode ?? '').trim() || null

  if (!eventId || !title) return json({ error: 'eventId e title são obrigatórios' }, 400)
  if (!ACTIVITY_TYPES.includes(activityType)) return json({ error: 'activityType inválido' }, 400)
  if (interestCode && !isInterestCode(interestCode)) return json({ error: 'interestCode inválido' }, 400)
  if ((startsAt && !endsAt) || (!startsAt && endsAt)) return json({ error: 'startsAt e endsAt devem ser informados juntos' }, 400)
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return json({ error: 'endsAt deve ser posterior a startsAt' }, 400)

  const event = await db.prepare(`SELECT * FROM academy_events WHERE tenant_id=? AND id=? AND smart_farm_experience=1 LIMIT 1`)
    .bind(auth.tenantId, eventId).first()
  if (!event) return json({ error: 'Smart Farm Experience não encontrada neste tenant' }, 404)
  if (startsAt && (new Date(startsAt).getTime() < new Date(event.starts_at).getTime() || new Date(endsAt!).getTime() > new Date(event.ends_at).getTime())) {
    return json({ error: 'Atividade deve ficar dentro do intervalo do evento' }, 400)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`
      INSERT INTO academy_smart_farm_agenda_items (
        id,tenant_id,event_id,title,description,activity_type,starts_at,ends_at,
        position,location_label,requires_practical_evidence,interest_code,created_by,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id,auth.tenantId,eventId,title,description,activityType,startsAt,endsAt,
      Math.floor(position),locationLabel,requiresPracticalEvidence ? 1 : 0,interestCode,auth.userId,now,now,
    ),
    auditStatement(db, auth, {
      action: 'smart_farm.agenda_item_created', resourceType: 'event_agenda_item', resourceId: id,
      metadata: { eventId, activityType, requiresPracticalEvidence, interestCode },
    }),
  ])
  return json({ data: { id,eventId,title,description,activityType,startsAt,endsAt,position:Math.floor(position),locationLabel,requiresPracticalEvidence,interestCode,createdAt:now,updatedAt:now } }, 201)
}

export const onRequestPut = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  let body: Record<string, unknown>
  try { body = await bodyJson(request) } catch { return json({ error: 'JSON inválido' }, 400) }
  const itemId = String(body.itemId ?? '').trim()
  if (!itemId) return json({ error: 'itemId é obrigatório' }, 400)
  const existing = await db.prepare('SELECT * FROM academy_smart_farm_agenda_items WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId,itemId).first()
  if (!existing) return json({ error: 'Item de agenda não encontrado neste tenant' }, 404)

  const title = String(body.title ?? existing.title).trim()
  const description = String(body.description ?? existing.description ?? '').trim()
  const activityType = String(body.activityType ?? existing.activity_type).trim()
  const startsAt = body.startsAt === null ? null : body.startsAt ? parseDate(body.startsAt) : existing.starts_at ?? null
  const endsAt = body.endsAt === null ? null : body.endsAt ? parseDate(body.endsAt) : existing.ends_at ?? null
  const position = Math.max(0, Number(body.position ?? existing.position ?? 0))
  const locationLabel = body.locationLabel === null ? null : String(body.locationLabel ?? existing.location_label ?? '').trim() || null
  const requiresPracticalEvidence = body.requiresPracticalEvidence == null ? Number(existing.requires_practical_evidence) === 1 : body.requiresPracticalEvidence === true
  const interestCode = body.interestCode === null ? null : String(body.interestCode ?? existing.interest_code ?? '').trim() || null
  if (!title || !ACTIVITY_TYPES.includes(activityType)) return json({ error: 'Dados de agenda inválidos' }, 400)
  if (interestCode && !isInterestCode(interestCode)) return json({ error: 'interestCode inválido' }, 400)
  if ((startsAt && !endsAt) || (!startsAt && endsAt)) return json({ error: 'startsAt e endsAt devem ser informados juntos' }, 400)

  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`UPDATE academy_smart_farm_agenda_items SET title=?,description=?,activity_type=?,starts_at=?,ends_at=?,position=?,location_label=?,requires_practical_evidence=?,interest_code=?,updated_at=? WHERE tenant_id=? AND id=?`)
      .bind(title,description,activityType,startsAt,endsAt,Math.floor(position),locationLabel,requiresPracticalEvidence?1:0,interestCode,now,auth.tenantId,itemId),
    auditStatement(db, auth, { action:'smart_farm.agenda_item_updated', resourceType:'event_agenda_item', resourceId:itemId, metadata:{ eventId:existing.event_id } }),
  ])
  return json({ data:{ id:itemId,eventId:existing.event_id,title,description,activityType,startsAt,endsAt,position:Math.floor(position),locationLabel,requiresPracticalEvidence,interestCode,updatedAt:now } })
}

export const onRequestDelete = async ({ env, request }: { env: Env; request: Request }) => {
  const auth = requireAdminContext(env, request, ['academy_admin','ifarm_admin'])
  if (auth instanceof Response) return auth
  const db = dbOr503(env); if (db instanceof Response) return db
  const itemId = new URL(request.url).searchParams.get('itemId')?.trim() ?? ''
  if (!itemId) return json({ error: 'itemId é obrigatório' }, 400)
  const existing = await db.prepare('SELECT * FROM academy_smart_farm_agenda_items WHERE tenant_id=? AND id=? LIMIT 1').bind(auth.tenantId,itemId).first()
  if (!existing) return json({ error: 'Item de agenda não encontrado' }, 404)
  await db.batch([
    db.prepare('DELETE FROM academy_smart_farm_agenda_items WHERE tenant_id=? AND id=?').bind(auth.tenantId,itemId),
    auditStatement(db, auth, { action:'smart_farm.agenda_item_deleted', resourceType:'event_agenda_item', resourceId:itemId, metadata:{ eventId:existing.event_id } }),
  ])
  return json({ data:{ id:itemId,deleted:true } })
}
