import { FormEvent, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { loadAdminEvents, loadEventCatalog, type AcademyEventRecord } from '../services/eventApi'
import {
  createSmartFarmAgendaItem,
  createSmartFarmQrToken,
  deleteSmartFarmAgendaItem,
  loadMySmartFarmInterests,
  loadPracticalEvidence,
  loadSmartFarmAgenda,
  loadSmartFarmLeads,
  loadSmartFarmQrTokens,
  registerSmartFarmInterest,
  reviewPracticalEvidence,
  revokeSmartFarmQrToken,
  smartFarmCheckinUrl,
  type CreatedSmartFarmQrToken,
  type PracticalEvidence,
  type SmartFarmActivityType,
  type SmartFarmAgendaItem,
  type SmartFarmInterestCode,
  type SmartFarmLead,
  type SmartFarmLeadStage,
  type SmartFarmQrToken,
  type SmartFarmTokenPurpose,
} from '../services/smartFarmApi'
import '../styles/smart-farm.css'

const interestLabels: Record<SmartFarmInterestCode, string> = {
  irrigation: 'Irrigação',
  iot: 'IoT rural',
  weather_station: 'Estação meteorológica',
  lorawan: 'LoRaWAN',
  drones: 'Drones',
  precision_agriculture: 'Agricultura de precisão',
  insurance: 'Seguros',
  credit: 'Crédito',
  technical_services: 'Serviços técnicos',
  ifarm_store: 'iFarm Store',
  other: 'Outro',
}

const activityLabels: Record<SmartFarmActivityType, string> = {
  field_activity: 'Atividade de campo',
  demonstration: 'Demonstração',
  lecture: 'Aula/palestra',
  visit: 'Visita técnica',
  break: 'Intervalo',
  other: 'Outro',
}

function dateTime(value?: string | null) {
  if (!value) return 'Horário a definir'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function SmartFarmExperiencePage() {
  const [events, setEvents] = useState<AcademyEventRecord[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [agenda, setAgenda] = useState<SmartFarmAgendaItem[]>([])
  const [tokens, setTokens] = useState<SmartFarmQrToken[]>([])
  const [evidence, setEvidence] = useState<PracticalEvidence[]>([])
  const [leads, setLeads] = useState<SmartFarmLead[]>([])
  const [myInterests, setMyInterests] = useState<SmartFarmLead[]>([])
  const [adminMode, setAdminMode] = useState(false)
  const [message, setMessage] = useState('Carregando Smart Farm Experience...')
  const [busy, setBusy] = useState(false)
  const [createdToken, setCreatedToken] = useState<CreatedSmartFarmQrToken | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [agendaForm, setAgendaForm] = useState({
    title: '', description: '', activityType: 'field_activity' as SmartFarmActivityType,
    startsAt: '', endsAt: '', position: '0', locationLabel: '', requiresPracticalEvidence: false,
    interestCode: '' as '' | SmartFarmInterestCode,
  })
  const [tokenForm, setTokenForm] = useState({ purpose: 'checkin' as SmartFarmTokenPurpose, agendaItemId: '', maxUses: '' })

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId) ?? null, [events, selectedEventId])
  const agendaInterests = useMemo(() => Array.from(new Set(agenda.map((item) => item.interestCode).filter(Boolean))) as SmartFarmInterestCode[], [agenda])
  const myInterestCodes = useMemo(() => new Set(myInterests.filter((item) => item.eventId === selectedEventId).map((item) => item.interestCode)), [myInterests, selectedEventId])

  async function loadEventData(eventId: string, isAdmin = adminMode) {
    if (!eventId) return
    const requests: Array<Promise<unknown>> = [
      loadSmartFarmAgenda(eventId).then(setAgenda),
      loadMySmartFarmInterests(eventId).then(setMyInterests),
    ]
    if (isAdmin) {
      requests.push(
        loadSmartFarmQrTokens(eventId).then(setTokens),
        loadPracticalEvidence(eventId).then(setEvidence),
        loadSmartFarmLeads(eventId).then(setLeads),
      )
    }
    await Promise.all(requests)
  }

  async function bootstrap() {
    setBusy(true)
    try {
      let source: AcademyEventRecord[] = []
      let admin = false
      try {
        source = (await loadAdminEvents()).filter((event) => event.smartFarmExperience)
        admin = true
      } catch {
        source = (await loadEventCatalog()).filter((event) => event.smartFarmExperience)
      }
      setAdminMode(admin)
      setEvents(source)
      const first = source[0]?.id ?? ''
      setSelectedEventId(first)
      if (first) await loadEventData(first, admin)
      setMessage(source.length ? 'Smart Farm Experience conectada à operação da Academy.' : 'Nenhuma Smart Farm Experience disponível.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a Smart Farm Experience.')
    } finally { setBusy(false) }
  }

  useEffect(() => { void bootstrap() }, [])

  async function selectEvent(eventId: string) {
    setSelectedEventId(eventId)
    setAgenda([]); setTokens([]); setEvidence([]); setLeads([]); setCreatedToken(null); setQrDataUrl('')
    setBusy(true)
    try { await loadEventData(eventId); setMessage('Experiência carregada.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar experiência.') }
    finally { setBusy(false) }
  }

  async function createAgenda(event: FormEvent) {
    event.preventDefault()
    if (!selectedEventId) return
    setBusy(true)
    try {
      await createSmartFarmAgendaItem({
        eventId: selectedEventId,
        title: agendaForm.title.trim(),
        description: agendaForm.description.trim(),
        activityType: agendaForm.activityType,
        startsAt: agendaForm.startsAt || null,
        endsAt: agendaForm.endsAt || null,
        position: Number(agendaForm.position || 0),
        locationLabel: agendaForm.locationLabel.trim() || null,
        requiresPracticalEvidence: agendaForm.requiresPracticalEvidence,
        interestCode: agendaForm.interestCode || null,
      })
      setAgenda(await loadSmartFarmAgenda(selectedEventId))
      setAgendaForm({ title:'',description:'',activityType:'field_activity',startsAt:'',endsAt:'',position:'0',locationLabel:'',requiresPracticalEvidence:false,interestCode:'' })
      setMessage('Atividade adicionada à agenda de campo.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível adicionar a atividade.') }
    finally { setBusy(false) }
  }

  async function removeAgenda(itemId: string) {
    if (!window.confirm('Remover esta atividade da agenda? Evidências vinculadas também serão afetadas.')) return
    setBusy(true)
    try { await deleteSmartFarmAgendaItem(itemId); setAgenda(await loadSmartFarmAgenda(selectedEventId)); setMessage('Atividade removida.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível remover.') }
    finally { setBusy(false) }
  }

  async function generateToken(event: FormEvent) {
    event.preventDefault()
    if (!selectedEventId) return
    setBusy(true); setCreatedToken(null); setQrDataUrl('')
    try {
      const created = await createSmartFarmQrToken({
        eventId: selectedEventId,
        purpose: tokenForm.purpose,
        agendaItemId: tokenForm.purpose === 'station' ? tokenForm.agendaItemId || null : null,
        maxUses: tokenForm.maxUses ? Number(tokenForm.maxUses) : null,
      })
      setCreatedToken(created)
      setQrDataUrl(await QRCode.toDataURL(smartFarmCheckinUrl(created.rawToken), { width: 260, margin: 1, errorCorrectionLevel: 'M' }))
      setTokens(await loadSmartFarmQrTokens(selectedEventId))
      setMessage('QR criado. O token bruto não poderá ser recuperado depois desta tela.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o QR.') }
    finally { setBusy(false) }
  }

  async function revokeToken(tokenId: string) {
    setBusy(true)
    try { await revokeSmartFarmQrToken(tokenId); setTokens(await loadSmartFarmQrTokens(selectedEventId)); setMessage('QR revogado.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível revogar.') }
    finally { setBusy(false) }
  }

  async function reviewEvidence(evidenceId: string, action: 'validate' | 'reject') {
    const note = action === 'reject' ? window.prompt('Justificativa da rejeição:') ?? '' : ''
    if (action === 'reject' && !note.trim()) return
    setBusy(true)
    try { await reviewPracticalEvidence(evidenceId, action, note); setEvidence(await loadPracticalEvidence(selectedEventId)); setMessage(action === 'validate' ? 'Evidência validada.' : 'Evidência rejeitada.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível revisar a evidência.') }
    finally { setBusy(false) }
  }

  async function registerInterest(code: SmartFarmInterestCode) {
    if (!selectedEventId) return
    const ok = window.confirm(`Ao confirmar, você autoriza a iFarm a registrar seu interesse em ${interestLabels[code]} e entrar em contato sobre esta oportunidade. Deseja continuar?`)
    if (!ok) return
    setBusy(true)
    try {
      await registerSmartFarmInterest(selectedEventId, code)
      setMyInterests(await loadMySmartFarmInterests(selectedEventId))
      if (adminMode) setLeads(await loadSmartFarmLeads(selectedEventId))
      setMessage('Interesse registrado com consentimento explícito.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível registrar o interesse.') }
    finally { setBusy(false) }
  }

  async function updateLead(leadId: string, stage: SmartFarmLeadStage) {
    setBusy(true)
    try { await import('../services/smartFarmApi').then(({ updateSmartFarmLeadStage }) => updateSmartFarmLeadStage(leadId, stage)); setLeads(await loadSmartFarmLeads(selectedEventId)); setMessage('Etapa comercial atualizada.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o lead.') }
    finally { setBusy(false) }
  }

  return (
    <div className="smartFarmPage">
      <header className="pageHeader smartFarmHeader">
        <div><small>iFarm Academy · Fazenda-escola</small><h1>Smart Farm Experience</h1><p>Agenda de campo, QR de presença, evidência prática e oportunidades comerciais com consentimento explícito.</p></div>
      </header>
      <div className="smartFarmMessage">{busy ? 'Processando... ' : ''}{message}</div>

      <section className="panel smartFarmSelector">
        <label>Experiência<select value={selectedEventId} onChange={(event) => void selectEvent(event.target.value)}>{events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        {selectedEvent && <div><strong>{selectedEvent.title}</strong><span>{dateTime(selectedEvent.startsAt)} · {selectedEvent.venueName || 'Local a confirmar'}</span></div>}
      </section>

      {selectedEvent && <>
        <section className="smartFarmSection">
          <div className="smartFarmSectionTitle"><div><small>Agenda</small><h2>Roteiro da experiência</h2></div></div>
          <div className="smartFarmAgenda">
            {agenda.map((item) => <article key={item.id}>
              <div><span>{item.position + 1}</span></div>
              <section><small>{activityLabels[item.activityType]} · {item.locationLabel || 'local a definir'}</small><h3>{item.title}</h3><p>{item.description || 'Atividade prática da Smart Farm Experience.'}</p><footer><span>{dateTime(item.startsAt)}</span>{item.requiresPracticalEvidence && <strong>Evidência prática obrigatória</strong>}{item.interestCode && <em>{interestLabels[item.interestCode]}</em>}</footer></section>
              {adminMode && <button onClick={() => void removeAgenda(item.id)}>Remover</button>}
            </article>)}
            {!agenda.length && <div className="smartFarmEmpty">Nenhuma atividade cadastrada.</div>}
          </div>
        </section>

        {!!agendaInterests.length && <section className="panel smartFarmInterestPanel">
          <div><small>Cross-sell consentido</small><h2>Soluções relacionadas ao que você viu no campo</h2><p>Nenhum lead é criado automaticamente. O contato só é autorizado após sua confirmação.</p></div>
          <div className="smartFarmInterestButtons">{agendaInterests.map((code) => <button key={code} disabled={myInterestCodes.has(code) || busy} onClick={() => void registerInterest(code)}>{myInterestCodes.has(code) ? `${interestLabels[code]} · interesse registrado` : `Tenho interesse em ${interestLabels[code]}`}</button>)}</div>
        </section>}

        {adminMode && <div className="smartFarmAdminGrid">
          <form className="panel smartFarmForm" onSubmit={createAgenda}>
            <div className="smartFarmSectionTitle"><div><small>Operação</small><h2>Adicionar atividade</h2></div></div>
            <label>Título<input required value={agendaForm.title} onChange={(e)=>setAgendaForm({...agendaForm,title:e.target.value})}/></label>
            <label>Descrição<textarea value={agendaForm.description} onChange={(e)=>setAgendaForm({...agendaForm,description:e.target.value})}/></label>
            <div className="smartFarmFormRow"><label>Tipo<select value={agendaForm.activityType} onChange={(e)=>setAgendaForm({...agendaForm,activityType:e.target.value as SmartFarmActivityType})}>{Object.entries(activityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Posição<input type="number" min="0" value={agendaForm.position} onChange={(e)=>setAgendaForm({...agendaForm,position:e.target.value})}/></label></div>
            <div className="smartFarmFormRow"><label>Início<input type="datetime-local" value={agendaForm.startsAt} onChange={(e)=>setAgendaForm({...agendaForm,startsAt:e.target.value})}/></label><label>Fim<input type="datetime-local" value={agendaForm.endsAt} onChange={(e)=>setAgendaForm({...agendaForm,endsAt:e.target.value})}/></label></div>
            <label>Local/estação<input value={agendaForm.locationLabel} onChange={(e)=>setAgendaForm({...agendaForm,locationLabel:e.target.value})}/></label>
            <label>Tema comercial<select value={agendaForm.interestCode} onChange={(e)=>setAgendaForm({...agendaForm,interestCode:e.target.value as ''|SmartFarmInterestCode})}><option value="">Sem cross-sell</option>{Object.entries(interestLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <label className="smartFarmCheck"><input type="checkbox" checked={agendaForm.requiresPracticalEvidence} onChange={(e)=>setAgendaForm({...agendaForm,requiresPracticalEvidence:e.target.checked})}/> Exigir evidência prática</label>
            <button className="primary" disabled={busy}>Adicionar à agenda</button>
          </form>

          <form className="panel smartFarmForm" onSubmit={generateToken}>
            <div className="smartFarmSectionTitle"><div><small>QR</small><h2>Gerar acesso operacional</h2></div></div>
            <label>Finalidade<select value={tokenForm.purpose} onChange={(e)=>setTokenForm({...tokenForm,purpose:e.target.value as SmartFarmTokenPurpose})}><option value="checkin">Check-in</option><option value="checkout">Check-out</option><option value="station">Estação prática</option></select></label>
            {tokenForm.purpose==='station'&&<label>Atividade<select required value={tokenForm.agendaItemId} onChange={(e)=>setTokenForm({...tokenForm,agendaItemId:e.target.value})}><option value="">Selecione</option>{agenda.map((item)=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
            <label>Máximo de usos<input type="number" min="1" value={tokenForm.maxUses} onChange={(e)=>setTokenForm({...tokenForm,maxUses:e.target.value})} placeholder="Sem limite"/></label>
            <button className="primary" disabled={busy}>Gerar QR</button>
            {createdToken&&<div className="smartFarmQrCreated">{qrDataUrl&&<img src={qrDataUrl} alt={`QR ${createdToken.purpose}`}/>}<strong>Token exibido uma única vez</strong><code>{createdToken.rawToken}</code><button type="button" onClick={()=>void navigator.clipboard?.writeText(smartFarmCheckinUrl(createdToken.rawToken))}>Copiar link</button></div>}
          </form>
        </div>}

        {adminMode && <section className="panel smartFarmTablePanel">
          <div className="smartFarmSectionTitle"><div><small>QR ativos</small><h2>Tokens operacionais</h2></div><span>{tokens.length}</span></div>
          <div className="smartFarmTable"><div className="smartFarmTableHead"><span>Finalidade</span><span>Atividade</span><span>Válido até</span><span>Usos</span><span>Status</span><span>Ação</span></div>{tokens.map((token)=><div className="smartFarmTableRow" key={token.id}><span>{token.purpose}</span><span>{token.agendaTitle||'—'}</span><span>{dateTime(token.validUntil)}</span><span>{token.useCount??0}{token.maxUses?`/${token.maxUses}`:''}</span><span>{token.active?'Ativo':'Revogado'}</span><button disabled={!token.active||busy} onClick={()=>void revokeToken(token.id)}>Revogar</button></div>)}</div>
        </section>}

        {adminMode && <section className="panel smartFarmTablePanel">
          <div className="smartFarmSectionTitle"><div><small>Prática</small><h2>Evidências para revisão</h2></div><span>{evidence.filter((item)=>item.status==='pending').length} pendentes</span></div>
          <div className="smartFarmTable evidence"><div className="smartFarmTableHead"><span>Participante</span><span>Atividade</span><span>Tipo</span><span>Status</span><span>Data</span><span>Ação</span></div>{evidence.map((item)=><div className="smartFarmTableRow" key={item.id}><span>{item.displayName||item.registrationId}</span><span>{item.agendaTitle}</span><span>{item.evidenceType}</span><span>{item.status}</span><span>{dateTime(item.createdAt)}</span><div>{item.status==='pending'&&<><button onClick={()=>void reviewEvidence(item.id,'validate')}>Validar</button><button onClick={()=>void reviewEvidence(item.id,'reject')}>Rejeitar</button></>}</div></div>)}</div>
        </section>}

        {adminMode && <section className="panel smartFarmTablePanel">
          <div className="smartFarmSectionTitle"><div><small>Motor comercial</small><h2>Leads consentidos</h2></div><span>{leads.length}</span></div>
          <div className="smartFarmTable leads"><div className="smartFarmTableHead"><span>Participante</span><span>Interesse</span><span>Consentimento</span><span>Origem</span><span>Etapa</span></div>{leads.map((lead)=><div className="smartFarmTableRow" key={lead.id}><span>{lead.displayName||lead.userId||'Participante'}</span><span>{interestLabels[lead.interestCode]}</span><span>{dateTime(lead.consentRecordedAt)}</span><span>Smart Farm Experience</span><select value={lead.stage} onChange={(e)=>void updateLead(lead.id,e.target.value as SmartFarmLeadStage)}><option value="new">Novo</option><option value="qualified">Qualificado</option><option value="contacted">Contactado</option><option value="converted">Convertido</option><option value="discarded">Descartado</option></select></div>)}</div>
        </section>}
      </>}
    </div>
  )
}
