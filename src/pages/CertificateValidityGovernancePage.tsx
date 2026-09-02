import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  loadCertificateValidityPolicies,
  removeCertificateValidityPolicy,
  saveCertificateValidityPolicy,
  type CertificateValidityCourse,
  type ValidityMode,
} from '../services/certificateValidityApi'
import '../styles/certificate-validity.css'

const typeLabels: Record<CertificateValidityCourse['certificateType'], string> = {
  free_course: 'Curso livre',
  corporate_training: 'Treinamento corporativo',
  regulatory_training: 'Treinamento regulamentar',
  partner_certification: 'Certificação de parceiro',
}

export function CertificateValidityGovernancePage() {
  const [courses, setCourses] = useState<CertificateValidityCourse[]>([])
  const [courseId, setCourseId] = useState('')
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    validityMode: 'fixed_months' as ValidityMode,
    validityMonths: '12',
    sourceReference: '',
    note: '',
    confirmed: false,
  })

  const selected = useMemo(() => courses.find((item) => item.courseId === courseId) ?? null, [courses, courseId])
  const regulatory = courses.filter((item) => item.certificateType === 'regulatory_training')

  async function refresh(preferred?: string) {
    setLoading(true)
    try {
      const items = await loadCertificateValidityPolicies()
      setCourses(items)
      const next = items.some((item) => item.courseId === (preferred || courseId))
        ? (preferred || courseId)
        : items.find((item) => item.certificateType === 'regulatory_training')?.courseId ?? items[0]?.courseId ?? ''
      setCourseId(next)
      setAvailable(true)
    } catch (error) {
      setAvailable(false)
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar políticas.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    if (!selected) return
    setForm(selected.policy ? {
      validityMode: selected.policy.validityMode,
      validityMonths: selected.policy.validityMonths == null ? '' : String(selected.policy.validityMonths),
      sourceReference: selected.policy.sourceReference,
      note: selected.policy.note,
      confirmed: false,
    } : { validityMode: 'fixed_months', validityMonths: '12', sourceReference: '', note: '', confirmed: false })
  }, [courseId])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setMessage('Salvando política...')
    try {
      const result = await saveCertificateValidityPolicy({
        courseId: selected.courseId,
        validityMode: form.validityMode,
        validityMonths: form.validityMode === 'fixed_months' ? Number(form.validityMonths) : null,
        sourceReference: form.sourceReference.trim(),
        note: form.note.trim(),
        confirmed: form.confirmed,
      })
      await refresh(selected.courseId)
      setMessage(`Política v${result.data.version} salva apenas para certificados futuros.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a política.')
    }
  }

  async function remove() {
    if (!selected?.policyConfigured) return
    if (!window.confirm('Remover a política atual? Certificados já emitidos permanecerão inalterados.')) return
    try {
      await removeCertificateValidityPolicy(selected.courseId)
      await refresh(selected.courseId)
      setMessage('Política removida para emissões futuras; snapshots anteriores preservados.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível remover a política.')
    }
  }

  return (
    <div className="validityPage">
      <header className="pageHeader"><div><small>iFarm Academy · Governança</small><h1>Política de validade dos certificados</h1><p>Regras explícitas para novas emissões, com histórico e confirmação humana.</p></div></header>

      {!available ? <section className="panel validityOffline"><h2>Governança preparada</h2><p>Esta área depende do backend/D1. Nenhuma validade regulatória é presumida.</p><small>{message}</small></section> : <>
        <section className="validityMetrics">
          <article><span>Cursos monitorados</span><strong>{courses.length}</strong></article>
          <article><span>Políticas configuradas</span><strong>{courses.filter((item) => item.policyConfigured).length}</strong></article>
          <article><span>Treinamentos regulatórios</span><strong>{regulatory.length}</strong></article>
          <article><span>Regulatórios sem política</span><strong>{regulatory.filter((item) => !item.policyConfigured).length}</strong></article>
        </section>

        {message && <div className="validityMessage">{message}</div>}

        <div className="validityGrid">
          <section className="panel validityCourseList">
            <div className="panelTitle"><h2>Cursos</h2><span>{loading ? 'Atualizando...' : `${courses.length} cursos`}</span></div>
            {courses.map((course) => <button key={course.courseId} className={courseId === course.courseId ? 'active' : ''} onClick={() => setCourseId(course.courseId)}>
              <div><strong>{course.courseTitle}</strong><small>{typeLabels[course.certificateType]} · {course.courseStatus}</small></div>
              <span>{course.policyConfigured ? `v${course.policy?.version}` : 'Não configurada'}</span>
            </button>)}
          </section>

          <form className="panel validityForm" onSubmit={save}>
            <div className="panelTitle"><h2>{selected?.courseTitle ?? 'Selecione um curso'}</h2></div>
            {selected?.certificateType === 'regulatory_training' && <div className="validityWarning">Ausência de política não significa validade regulatória indefinida. A regra aplicável precisa ser validada por pessoa responsável.</div>}

            <label>Modo<select value={form.validityMode} onChange={(event) => setForm({ ...form, validityMode: event.target.value as ValidityMode, confirmed: false })}><option value="fixed_months">Prazo fixo em meses</option><option value="indefinite">Sem data de expiração segundo política registrada</option></select></label>
            {form.validityMode === 'fixed_months' && <label>Validade em meses<input type="number" min="1" max="1200" required value={form.validityMonths} onChange={(event) => setForm({ ...form, validityMonths: event.target.value, confirmed: false })} /></label>}
            <label>Fonte / referência<input required minLength={3} value={form.sourceReference} onChange={(event) => setForm({ ...form, sourceReference: event.target.value, confirmed: false })} placeholder="Norma analisada, procedimento, contrato..." /></label>
            <label>Justificativa<textarea required minLength={5} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value, confirmed: false })} /></label>
            <label className="validityConfirm"><input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} /><span>Confirmo que esta regra foi analisada e deve valer apenas para certificados futuros.</span></label>

            {selected?.policy && <div className="validityCurrent"><strong>Política atual v{selected.policy.version}</strong><span>{selected.policy.validityMode === 'fixed_months' ? `${selected.policy.validityMonths} meses` : 'Sem data de expiração registrada'}</span><small>Confirmada por {selected.policy.confirmedBy}</small></div>}
            <div className="validityActions"><button className="primary" type="submit" disabled={!selected || !form.confirmed}>Salvar nova versão</button>{selected?.policyConfigured && <button type="button" onClick={() => void remove()}>Remover política atual</button>}</div>
          </form>
        </div>

        <section className="panel validityPrinciple"><h2>Imutabilidade</h2><p>Alterar ou remover a política não modifica a validade congelada em certificados já emitidos.</p></section>
      </>}
    </div>
  )
}
