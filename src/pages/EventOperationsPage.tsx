import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  cancelEvent,
  cancelEventRegistration,
  createEvent,
  loadAdminEvents,
  loadEventAttendance,
  loadEventCatalog,
  loadMyEventRegistrations,
  recordEventAttendance,
  registerForEvent,
  updateEvent,
  type AcademyEventAccessModel,
  type AcademyEventModality,
  type AcademyEventRecord,
  type AcademyEventType,
  type EventRegistrationRecord,
} from '../services/eventApi'
import '../styles/events.css'

const eventTypeLabel: Record<AcademyEventType, string> = {
  workshop: 'Workshop',
  field_day: 'Dia de campo',
  practical_class: 'Aula prática',
  training: 'Treinamento',
  webinar: 'Webinar',
  other: 'Outro',
}
const modalityLabel: Record<AcademyEventModality, string> = {
  in_person: 'Presencial', online: 'Online', hybrid: 'Híbrido',
}
const registrationLabel: Record<string, string> = {
  registered: 'Inscrito', waitlisted: 'Lista de espera', cancelled: 'Cancelado', attended: 'Presente', no_show: 'Ausente',
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function centsToBRL(value?: number | null) {
  if (value == null) return 'Gratuito'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
}

export function EventOperationsPage() {
  const [catalog, setCatalog] = useState<AcademyEventRecord[]>([])
  const [adminEvents, setAdminEvents] = useState<AcademyEventRecord[]>([])
  const [myRegistrations, setMyRegistrations] = useState<EventRegistrationRecord[]>([])
  const [attendance, setAttendance] = useState<EventRegistrationRecord[]>([])
  const [selectedAttendanceEventId, setSelectedAttendanceEventId] = useState('')
  const [adminAvailable, setAdminAvailable] = useState(true)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', eventType: 'field_day' as AcademyEventType,
    modality: 'in_person' as AcademyEventModality, accessModel: 'free' as AcademyEventAccessModel,
    priceReais: '', startsAt: '', endsAt: '', registrationDeadline: '', capacity: '',
    venueName: '', addressText: '', meetingUrl: '', smartFarmExperience: true, publishNow: true,
  })

  const registrationsByEvent = useMemo(() => new Map(myRegistrations.map((item) => [item.eventId, item])), [myRegistrations])
  const publishedAdminEvents = useMemo(() => adminEvents.filter((item) => item.status === 'published'), [adminEvents])

  async function refreshPublic() {
    const [catalogItems, registrations] = await Promise.all([loadEventCatalog(), loadMyEventRegistrations()])
    setCatalog(catalogItems)
    setMyRegistrations(registrations)
  }

  async function refreshAdmin() {
    try {
      const events = await loadAdminEvents()
      setAdminEvents(events)
      setAdminAvailable(true)
      return events
    } catch {
      setAdminAvailable(false)
      setAdminEvents([])
      return []
    }
  }

  async function bootstrap() {
    setLoading(true)
    try {
      await Promise.all([refreshPublic(), refreshAdmin()])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar eventos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void bootstrap() }, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    const priceCents = form.accessModel === 'paid' ? Math.round(Number(form.priceReais.replace(',', '.')) * 100) : null
    setMessage('Salvando evento...')
    try {
      await createEvent({
        title: form.title.trim(),
        description: form.description.trim(),
        eventType: form.eventType,
        modality: form.modality,
        accessModel: form.accessModel,
        priceCents,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        registrationDeadline: form.registrationDeadline || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        venueName: form.venueName.trim() || null,
        addressText: form.addressText.trim() || null,
        meetingUrl: form.meetingUrl.trim() || null,
        smartFarmExperience: form.smartFarmExperience,
        status: form.publishNow ? 'published' : 'draft',
      })
      setForm({ title: '', description: '', eventType: 'field_day', modality: 'in_person', accessModel: 'free', priceReais: '', startsAt: '', endsAt: '', registrationDeadline: '', capacity: '', venueName: '', addressText: '', meetingUrl: '', smartFarmExperience: true, publishNow: true })
      await Promise.all([refreshAdmin(), refreshPublic()])
      setMessage('Evento criado com sucesso.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar o evento.')
    }
  }

  async function handleRegister(eventId: string) {
    setBusyId(eventId)
    try {
      const result = await registerForEvent(eventId)
      await refreshPublic()
      setMessage(result.data.waitlisted ? 'Evento lotado: inscrição adicionada à lista de espera.' : 'Inscrição confirmada.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível realizar a inscrição.')
    } finally { setBusyId('') }
  }

  async function handleCancelRegistration(eventId: string) {
    if (!window.confirm('Cancelar sua inscrição neste evento?')) return
    setBusyId(eventId)
    try {
      const result = await cancelEventRegistration(eventId)
      await Promise.all([refreshPublic(), refreshAdmin()])
      setMessage(result.data.promotedRegistrationId ? 'Inscrição cancelada e primeira pessoa da lista de espera promovida.' : 'Inscrição cancelada.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível cancelar a inscrição.')
    } finally { setBusyId('') }
  }

  async function handlePublish(event: AcademyEventRecord) {
    setBusyId(event.id)
    try {
      await updateEvent({ eventId: event.id, status: 'published' })
      await Promise.all([refreshAdmin(), refreshPublic()])
      setMessage('Evento publicado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível publicar.') }
    finally { setBusyId('') }
  }

  async function handleCancelEvent(eventId: string) {
    if (!window.confirm('Cancelar o evento e todas as inscrições ativas?')) return
    setBusyId(eventId)
    try {
      await cancelEvent(eventId)
      await Promise.all([refreshAdmin(), refreshPublic()])
      if (selectedAttendanceEventId === eventId) setAttendance([])
      setMessage('Evento cancelado. Inscrições ativas também foram canceladas.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível cancelar o evento.') }
    finally { setBusyId('') }
  }

  async function handleOpenAttendance(eventId: string) {
    setSelectedAttendanceEventId(eventId)
    setBusyId(eventId)
    try {
      setAttendance(await loadEventAttendance(eventId))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar participantes.') }
    finally { setBusyId('') }
  }

  async function handleAttendance(registrationId: string, action: 'checkin' | 'checkout' | 'no_show') {
    setBusyId(registrationId)
    try {
      await recordEventAttendance({ registrationId, action, evidenceType: action === 'checkin' ? 'manual' : undefined, evidence: action === 'checkin' ? { source: 'academy_admin_panel' } : undefined })
      if (selectedAttendanceEventId) setAttendance(await loadEventAttendance(selectedAttendanceEventId))
      await refreshAdmin()
      setMessage(action === 'checkin' ? 'Presença registrada com evidência manual.' : action === 'checkout' ? 'Saída registrada.' : 'Ausência registrada.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a presença.') }
    finally { setBusyId('') }
  }

  return (
    <div className="eventsPage">
      <div className="pageHeader">
        <div>
          <h1>Eventos & Smart Farm Experience</h1>
          <p>Workshops, dias de campo, aulas práticas, treinamentos e webinars com inscrição e evidência de presença.</p>
          <small>{loading ? 'Carregando eventos...' : 'Operação de eventos conectada à Academy'} </small>
          {message && <small className="eventsMessage">{message}</small>}
        </div>
      </div>

      <section className="eventMetrics">
        <article><span>Próximos eventos</span><strong>{catalog.length}</strong></article>
        <article><span>Minhas inscrições</span><strong>{myRegistrations.filter((item) => ['registered','waitlisted','attended'].includes(item.status)).length}</strong></article>
        <article><span>Smart Farm Experience</span><strong>{catalog.filter((item) => item.smartFarmExperience).length}</strong></article>
        <article><span>Na lista de espera</span><strong>{myRegistrations.filter((item) => item.status === 'waitlisted').length}</strong></article>
      </section>

      <section className="panel eventsCatalogPanel">
        <div className="panelTitle"><h2>Agenda disponível</h2><span>{catalog.length} eventos publicados</span></div>
        <div className="eventCards">
          {catalog.map((event) => {
            const registration = registrationsByEvent.get(event.id)
            const full = event.capacity != null && Number(event.occupied ?? 0) >= event.capacity
            return (
              <article key={event.id} className={event.smartFarmExperience ? 'smartFarm' : ''}>
                <div className="eventCardTop"><span>{eventTypeLabel[event.eventType]}</span>{event.smartFarmExperience && <strong>Smart Farm Experience</strong>}</div>
                <h3>{event.title}</h3>
                <p>{event.description || 'Evento de capacitação iFarm Academy.'}</p>
                <div className="eventFacts">
                  <span>{formatDateTime(event.startsAt)}</span>
                  <span>{modalityLabel[event.modality]}</span>
                  <span>{event.venueName || (event.modality === 'online' ? 'Online' : 'Local a confirmar')}</span>
                  <span>{event.accessModel === 'paid' ? centsToBRL(event.priceCents) : event.accessModel === 'sponsored' ? 'Patrocinado' : 'Gratuito'}</span>
                </div>
                <div className="eventCapacity"><span>{event.capacity ? `${event.occupied ?? 0}/${event.capacity} vagas` : 'Sem limite de vagas'}</span>{full && <strong>Lista de espera ativa</strong>}</div>
                <div className="eventActions">
                  {registration && registration.status !== 'cancelled' ? (
                    <><span className={`eventRegistrationStatus ${registration.status}`}>{registrationLabel[registration.status]}</span>{!['attended'].includes(registration.status) && <button disabled={busyId === event.id} onClick={() => void handleCancelRegistration(event.id)}>Cancelar inscrição</button>}</>
                  ) : event.accessModel === 'paid' ? (
                    <button disabled title="Será habilitado junto ao checkout">Checkout necessário</button>
                  ) : (
                    <button className="primary" disabled={busyId === event.id} onClick={() => void handleRegister(event.id)}>{full ? 'Entrar na lista de espera' : 'Inscrever-se'}</button>
                  )}
                </div>
              </article>
            )
          })}
          {!catalog.length && <div className="enterpriseEmpty">Nenhum evento publicado no momento.</div>}
        </div>
      </section>

      {adminAvailable && (
        <>
          <div className="eventAdminGrid">
            <form className="panel enterpriseForm eventForm" onSubmit={handleCreate}>
              <div className="panelTitle"><h2>Novo evento</h2></div>
              <label>Título<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <label>Descrição<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <div className="eventFormRow">
                <label>Tipo<select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value as AcademyEventType })}><option value="field_day">Dia de campo</option><option value="workshop">Workshop</option><option value="practical_class">Aula prática</option><option value="training">Treinamento</option><option value="webinar">Webinar</option><option value="other">Outro</option></select></label>
                <label>Modalidade<select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value as AcademyEventModality })}><option value="in_person">Presencial</option><option value="online">Online</option><option value="hybrid">Híbrido</option></select></label>
              </div>
              <div className="eventFormRow">
                <label>Início<input required type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label>
                <label>Fim<input required type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label>
              </div>
              <div className="eventFormRow">
                <label>Modelo<select value={form.accessModel} onChange={(e) => setForm({ ...form, accessModel: e.target.value as AcademyEventAccessModel })}><option value="free">Gratuito</option><option value="sponsored">Patrocinado</option><option value="paid">Pago</option></select></label>
                <label>Vagas<input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Sem limite" /></label>
              </div>
              {form.accessModel === 'paid' && <label>Preço em R$<input required type="number" min="0.01" step="0.01" value={form.priceReais} onChange={(e) => setForm({ ...form, priceReais: e.target.value })} /></label>}
              <label>Prazo de inscrição<input type="datetime-local" value={form.registrationDeadline} onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })} /></label>
              <label>Local<input value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} /></label>
              <label>Endereço<input value={form.addressText} onChange={(e) => setForm({ ...form, addressText: e.target.value })} /></label>
              {form.modality !== 'in_person' && <label>Link da reunião<input value={form.meetingUrl} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} /></label>}
              <label className="enterpriseCheck"><input type="checkbox" checked={form.smartFarmExperience} onChange={(e) => setForm({ ...form, smartFarmExperience: e.target.checked })} /> Smart Farm Experience</label>
              <label className="enterpriseCheck"><input type="checkbox" checked={form.publishNow} onChange={(e) => setForm({ ...form, publishNow: e.target.checked })} /> Publicar imediatamente</label>
              <button className="primary" type="submit">Criar evento</button>
            </form>

            <section className="panel eventAdminList">
              <div className="panelTitle"><h2>Operação</h2><span>{adminEvents.length} eventos</span></div>
              {adminEvents.map((event) => <article key={event.id}>
                <div><strong>{event.title}</strong><small>{eventTypeLabel[event.eventType]} · {formatDateTime(event.startsAt)}</small></div>
                <div><span>{event.status}</span><small>{event.occupied ?? 0} inscritos · {event.waitlisted ?? 0} espera · {event.attended ?? 0} presentes</small></div>
                <div className="eventAdminActions">
                  {event.status === 'draft' && <button className="primary" disabled={busyId === event.id} onClick={() => void handlePublish(event)}>Publicar</button>}
                  {event.status === 'published' && <button onClick={() => void handleOpenAttendance(event.id)}>Participantes</button>}
                  {!['cancelled','completed'].includes(event.status) && <button onClick={() => void handleCancelEvent(event.id)}>Cancelar</button>}
                </div>
              </article>)}
              {!adminEvents.length && <div className="enterpriseEmpty">Nenhum evento administrativo.</div>}
            </section>
          </div>

          {selectedAttendanceEventId && (
            <section className="panel eventAttendancePanel">
              <div className="panelTitle"><h2>Presença e evidências</h2><span>{attendance.length} participantes</span></div>
              <div className="eventAttendanceTable">
                <div className="eventAttendanceHead"><span>Participante</span><span>Status</span><span>Check-in</span><span>Evidências</span><span>Ações</span></div>
                {attendance.map((item) => <div className="eventAttendanceRow" key={item.id}>
                  <div><strong>{item.displayName || item.userId}</strong><small>{item.userId}</small></div>
                  <span>{registrationLabel[item.status]}</span>
                  <span>{formatDateTime(item.checkinAt)}</span>
                  <span>{item.evidenceCount ?? 0}</span>
                  <div className="eventAdminActions">
                    {item.status === 'registered' && <button className="primary" disabled={busyId === item.id} onClick={() => void handleAttendance(item.id, 'checkin')}>Check-in</button>}
                    {item.status === 'registered' && <button disabled={busyId === item.id} onClick={() => void handleAttendance(item.id, 'no_show')}>Ausente</button>}
                    {item.status === 'attended' && !item.checkoutAt && <button disabled={busyId === item.id} onClick={() => void handleAttendance(item.id, 'checkout')}>Checkout</button>}
                  </div>
                </div>)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
