import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  activateMarketplaceCommissionRule,
  loadMarketplaceCatalog,
  loadMarketplaceEligibleCourses,
  loadMarketplacePermissions,
  loadMarketplaceSubmissions,
  publishMarketplaceSubmission,
  reviewMarketplaceSubmission,
  submitCourseToMarketplace,
  type MarketplaceCatalogItem,
  type MarketplaceCourseOption,
  type MarketplacePermissions,
  type MarketplaceSubmission,
} from '../services/marketplaceApi'
import '../styles/marketplace.css'

const statusLabel: Record<string, string> = {
  submitted: 'Enviado', under_review: 'Em revisão', changes_requested: 'Ajustes solicitados',
  approved: 'Aprovado', rejected: 'Rejeitado', published: 'Publicado', withdrawn: 'Retirado',
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function ruleSummary(item: MarketplaceSubmission) {
  const rule = item.activeCommissionRule
  if (!rule) return 'Comissão não configurada'
  if (rule.calculationMode === 'percentage') {
    return `Regra v${rule.version}: iFarm ${(rule.ifarmShareValue / 100).toFixed(2)}% · Instrutor ${(rule.instructorShareValue / 100).toFixed(2)}% · Parceiro ${(rule.partnerShareValue / 100).toFixed(2)}%`
  }
  const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
  return `Regra v${rule.version}: iFarm ${money(rule.ifarmShareValue)} · Instrutor ${money(rule.instructorShareValue)} · Parceiro ${money(rule.partnerShareValue)}`
}

export function MarketplacePage() {
  const [permissions, setPermissions] = useState<MarketplacePermissions>({ canSubmit: false, canReview: false, canConfigureCommission: false, canPublish: false })
  const [courses, setCourses] = useState<MarketplaceCourseOption[]>([])
  const [submissions, setSubmissions] = useState<MarketplaceSubmission[]>([])
  const [catalog, setCatalog] = useState<MarketplaceCatalogItem[]>([])
  const [courseId, setCourseId] = useState('')
  const [submissionNote, setSubmissionNote] = useState('')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [selectedCommissionId, setSelectedCommissionId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  const [commission, setCommission] = useState({
    mode: 'percentage' as 'percentage' | 'fixed_amount', ifarm: '', instructor: '', partner: '',
    gateway: 'ifarm' as 'ifarm' | 'instructor' | 'partner' | 'shared', validFrom: '', validUntil: '', rationale: '', confirmed: false,
  })

  const selectedSubmission = useMemo(() => submissions.find((item) => item.id === selectedCommissionId) ?? null, [submissions, selectedCommissionId])
  const pendingCount = submissions.filter((item) => ['submitted','under_review','changes_requested'].includes(item.status)).length
  const missingRuleCount = submissions.filter((item) => item.status === 'approved' && !item.activeCommissionRule).length

  async function refresh() {
    try {
      const [p, c, s, listed] = await Promise.all([
        loadMarketplacePermissions(), loadMarketplaceEligibleCourses(), loadMarketplaceSubmissions(), loadMarketplaceCatalog(),
      ])
      setPermissions(p); setCourses(c); setSubmissions(s); setCatalog(listed)
      if (!courseId && c.length) setCourseId(c[0].id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o marketplace.')
    }
  }

  useEffect(() => { void refresh() }, [])

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!courseId) return
    setBusy('submit')
    try {
      await submitCourseToMarketplace(courseId, submissionNote.trim() || undefined)
      setSubmissionNote(''); await refresh(); setMessage('Curso enviado para análise do marketplace.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao enviar curso.') }
    finally { setBusy('') }
  }

  async function transition(item: MarketplaceSubmission, targetStatus: 'under_review'|'approved'|'changes_requested'|'rejected') {
    setBusy(item.id)
    try {
      const note = reviewNotes[item.id]?.trim()
      await reviewMarketplaceSubmission(item.id, targetStatus, note || undefined)
      await refresh(); setMessage(`Submissão atualizada para ${statusLabel[targetStatus]}.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha na revisão.') }
    finally { setBusy('') }
  }

  function openCommission(item: MarketplaceSubmission) {
    setSelectedCommissionId(item.id)
    setCommission({ mode: 'percentage', ifarm: '', instructor: '', partner: '', gateway: 'ifarm', validFrom: new Date().toISOString().slice(0,16), validUntil: '', rationale: '', confirmed: false })
  }

  async function saveCommission(event: FormEvent) {
    event.preventDefault(); if (!selectedSubmission) return
    const factor = commission.mode === 'percentage' ? 100 : 100
    const values = [commission.ifarm, commission.instructor, commission.partner].map((value) => Math.round(Number(value.replace(',', '.')) * factor))
    if (values.some((value) => !Number.isFinite(value) || value < 0)) { setMessage('Preencha todos os valores da comissão.'); return }
    if (commission.mode === 'percentage' && values.reduce((sum, value) => sum + value, 0) !== 10000) { setMessage('As participações percentuais precisam totalizar 100%.'); return }
    setBusy('commission')
    try {
      await activateMarketplaceCommissionRule({
        submissionId: selectedSubmission.id, calculationMode: commission.mode,
        ifarmShareValue: values[0], instructorShareValue: values[1], partnerShareValue: values[2], currency: 'BRL',
        gatewayFeeResponsibility: commission.gateway,
        validFrom: new Date(commission.validFrom).toISOString(), validUntil: commission.validUntil ? new Date(commission.validUntil).toISOString() : null,
        rationale: commission.rationale.trim(), confirmed: commission.confirmed,
      })
      setSelectedCommissionId(''); await refresh(); setMessage('Nova versão da regra de comissão ativada e auditada.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao configurar comissão.') }
    finally { setBusy('') }
  }

  async function publish(item: MarketplaceSubmission) {
    setBusy(item.id)
    try { await publishMarketplaceSubmission(item.id); await refresh(); setMessage('Curso publicado no marketplace interno.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao publicar no marketplace.') }
    finally { setBusy('') }
  }

  return <div className="marketplacePage">
    <div className="pageHeader"><div><h1>Marketplace</h1><p>Submissão de cursos parceiros, revisão, regras comerciais versionadas e publicação controlada.</p>{message && <small className="marketplaceMessage">{message}</small>}</div></div>

    <section className="marketplaceMetrics">
      <article><span>Submissões</span><strong>{submissions.length}</strong></article>
      <article><span>Em processamento</span><strong>{pendingCount}</strong></article>
      <article><span>Aprovados sem comissão</span><strong>{missingRuleCount}</strong></article>
      <article><span>Listados</span><strong>{catalog.length}</strong></article>
    </section>

    {permissions.canSubmit && <form className="panel marketplaceSubmit" onSubmit={submit}>
      <div className="panelTitle"><h2>Submeter curso</h2><span>Somente cursos academicamente publicados</span></div>
      <label>Curso<select value={courseId} onChange={(e) => setCourseId(e.target.value)} required><option value="">Selecione</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
      <label>Observação<textarea value={submissionNote} onChange={(e) => setSubmissionNote(e.target.value)} placeholder="Contexto para a equipe de revisão" /></label>
      <button className="primary" disabled={busy === 'submit' || !courseId}>{busy === 'submit' ? 'Enviando...' : 'Enviar para análise'}</button>
    </form>}

    <section className="panel marketplaceQueue">
      <div className="panelTitle"><h2>{permissions.canReview ? 'Fila de marketplace' : 'Minhas submissões'}</h2><span>{submissions.length} registros</span></div>
      <div className="marketplaceCards">
        {submissions.map((item) => <article key={item.id}>
          <div className="marketplaceCardHeader"><div><small>{item.instructorName}</small><h3>{item.courseTitle}</h3></div><span className={`marketplaceStatus ${item.status}`}>{statusLabel[item.status]}</span></div>
          <p>{item.submissionNote || 'Sem observação de submissão.'}</p>
          {item.reviewNote && <div className="marketplaceReviewNote"><strong>Revisão</strong><span>{item.reviewNote}</span></div>}
          <div className="marketplaceRuleSummary">{ruleSummary(item)}</div>
          <small>Enviado em {formatDate(item.submittedAt)}{item.publishedAt ? ` · Publicado em ${formatDate(item.publishedAt)}` : ''}</small>

          {permissions.canReview && ['under_review','submitted'].includes(item.status) && <textarea value={reviewNotes[item.id] ?? ''} onChange={(e) => setReviewNotes({ ...reviewNotes, [item.id]: e.target.value })} placeholder="Parecer da revisão (obrigatório para ajustes/rejeição)" />}
          {permissions.canReview && <div className="marketplaceActions">
            {item.status === 'submitted' && <button disabled={busy === item.id} onClick={() => void transition(item, 'under_review')}>Iniciar revisão</button>}
            {item.status === 'under_review' && <><button className="primary" disabled={busy === item.id} onClick={() => void transition(item, 'approved')}>Aprovar</button><button disabled={busy === item.id} onClick={() => void transition(item, 'changes_requested')}>Solicitar ajustes</button><button disabled={busy === item.id} onClick={() => void transition(item, 'rejected')}>Rejeitar</button></>}
            {permissions.canConfigureCommission && ['approved','published'].includes(item.status) && <button onClick={() => openCommission(item)}>{item.activeCommissionRule ? 'Nova versão da comissão' : 'Configurar comissão'}</button>}
            {permissions.canPublish && item.status === 'approved' && <button className="primary" disabled={!item.activeCommissionRule || busy === item.id} title={!item.activeCommissionRule ? 'Configure uma regra de comissão antes de publicar' : ''} onClick={() => void publish(item)}>Publicar no marketplace</button>}
          </div>}
        </article>)}
        {!submissions.length && <div className="enterpriseEmpty">Nenhuma submissão encontrada.</div>}
      </div>
    </section>

    {selectedSubmission && permissions.canConfigureCommission && <form className="panel marketplaceCommission" onSubmit={saveCommission}>
      <div className="panelTitle"><h2>Regra de comissão</h2><span>{selectedSubmission.courseTitle}</span></div>
      <p>Nenhum percentual é sugerido pela plataforma. Os valores abaixo devem refletir decisão comercial aprovada.</p>
      <label>Modelo<select value={commission.mode} onChange={(e) => setCommission({ ...commission, mode: e.target.value as 'percentage'|'fixed_amount' })}><option value="percentage">Percentual</option><option value="fixed_amount">Valor fixo por venda</option></select></label>
      <div className="marketplaceCommissionGrid">
        <label>iFarm {commission.mode === 'percentage' ? '%' : 'R$'}<input required type="number" min="0" step="0.01" value={commission.ifarm} onChange={(e) => setCommission({ ...commission, ifarm: e.target.value })} /></label>
        <label>Instrutor {commission.mode === 'percentage' ? '%' : 'R$'}<input required type="number" min="0" step="0.01" value={commission.instructor} onChange={(e) => setCommission({ ...commission, instructor: e.target.value })} /></label>
        <label>Parceiro {commission.mode === 'percentage' ? '%' : 'R$'}<input required type="number" min="0" step="0.01" value={commission.partner} onChange={(e) => setCommission({ ...commission, partner: e.target.value })} /></label>
      </div>
      <label>Taxa do gateway<select value={commission.gateway} onChange={(e) => setCommission({ ...commission, gateway: e.target.value as typeof commission.gateway })}><option value="ifarm">iFarm</option><option value="instructor">Instrutor</option><option value="partner">Parceiro</option><option value="shared">Compartilhada</option></select></label>
      <div className="marketplaceCommissionGrid"><label>Vigência inicial<input required type="datetime-local" value={commission.validFrom} onChange={(e) => setCommission({ ...commission, validFrom: e.target.value })} /></label><label>Vigência final<input type="datetime-local" value={commission.validUntil} onChange={(e) => setCommission({ ...commission, validUntil: e.target.value })} /></label></div>
      <label>Justificativa<textarea required value={commission.rationale} onChange={(e) => setCommission({ ...commission, rationale: e.target.value })} /></label>
      <label className="enterpriseCheck"><input type="checkbox" checked={commission.confirmed} onChange={(e) => setCommission({ ...commission, confirmed: e.target.checked })} /> Confirmo que esta regra comercial foi definida e deve ser versionada.</label>
      <div className="marketplaceActions"><button type="button" onClick={() => setSelectedCommissionId('')}>Cancelar</button><button className="primary" disabled={busy === 'commission' || !commission.confirmed}>Ativar nova versão</button></div>
    </form>}

    <section className="panel marketplaceCatalog">
      <div className="panelTitle"><h2>Catálogo marketplace</h2><span>{catalog.length} listados</span></div>
      <div className="marketplaceCatalogGrid">{catalog.map((item) => <article key={item.submissionId}><small>Instrutor</small><h3>{item.title}</h3><p>{item.instructor.name}</p><span>Regra comercial v{item.commissionRuleVersion}</span><button disabled title="Checkout será habilitado na camada comercial">Checkout ainda não habilitado</button></article>)}</div>
      {!catalog.length && <div className="enterpriseEmpty">Nenhum curso publicado no marketplace.</div>}
    </section>
  </div>
}
