import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  addCompanyMember,
  assignCompanyCourse,
  cancelCompanyAssignment,
  createCompany,
  loadCompanies,
  loadCompanyAssignments,
  loadCompanyMembers,
  loadCompanyTrainingSummary,
  loadEnterpriseCatalog,
  type CompanyAssignmentRecord,
  type CompanyMemberRecord,
  type CompanyRecord,
  type CompanyTrainingSummary,
} from '../services/enterpriseApi'
import type { CatalogCourse } from '../services/enrollmentApi'
import '../styles/enterprise.css'

const statusLabel: Record<CompanyAssignmentRecord['effectiveStatus'], string> = {
  assigned: 'Atribuído',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem prazo'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR')
}

export function EnterpriseTrainingPage() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [members, setMembers] = useState<CompanyMemberRecord[]>([])
  const [assignments, setAssignments] = useState<CompanyAssignmentRecord[]>([])
  const [catalog, setCatalog] = useState<CatalogCourse[]>([])
  const [summary, setSummary] = useState<CompanyTrainingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [serverAvailable, setServerAvailable] = useState(true)
  const [message, setMessage] = useState('')

  const [companyName, setCompanyName] = useState('')
  const [companyDocument, setCompanyDocument] = useState('')
  const [memberForm, setMemberForm] = useState({ userId: '', displayName: '', employeeCode: '', jobTitle: '' })
  const [assignmentForm, setAssignmentForm] = useState({ memberId: '', courseId: '', dueAt: '', required: true })

  const selectedCompany = useMemo(() => companies.find((item) => item.id === selectedCompanyId) ?? null, [companies, selectedCompanyId])

  async function refreshCompanies(preferredId?: string) {
    const items = await loadCompanies()
    setCompanies(items)
    const nextId = preferredId && items.some((item) => item.id === preferredId)
      ? preferredId
      : selectedCompanyId && items.some((item) => item.id === selectedCompanyId)
        ? selectedCompanyId
        : items[0]?.id ?? ''
    setSelectedCompanyId(nextId)
    return nextId
  }

  async function refreshCompany(companyId: string) {
    if (!companyId) {
      setMembers([])
      setAssignments([])
      setSummary(null)
      return
    }
    const [memberItems, assignmentItems, summaryData] = await Promise.all([
      loadCompanyMembers(companyId),
      loadCompanyAssignments(companyId),
      loadCompanyTrainingSummary(companyId),
    ])
    setMembers(memberItems)
    setAssignments(assignmentItems)
    setSummary(summaryData)
    setAssignmentForm((current) => ({
      ...current,
      memberId: memberItems.some((item) => item.id === current.memberId) ? current.memberId : memberItems[0]?.id ?? '',
    }))
  }

  async function bootstrap() {
    setLoading(true)
    try {
      const [, courses] = await Promise.all([refreshCompanies(), loadEnterpriseCatalog()])
      setCatalog(courses)
      setServerAvailable(true)
    } catch {
      setServerAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void bootstrap() }, [])

  useEffect(() => {
    if (!serverAvailable || !selectedCompanyId) return
    void refreshCompany(selectedCompanyId).catch((error) => setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a empresa.'))
  }, [selectedCompanyId, serverAvailable])

  async function handleCreateCompany(event: FormEvent) {
    event.preventDefault()
    if (!companyName.trim()) return
    setMessage('Criando empresa...')
    try {
      const result = await createCompany({ name: companyName.trim(), documentLabel: companyDocument.trim() || undefined })
      setCompanyName('')
      setCompanyDocument('')
      await refreshCompanies(result.data.id)
      setMessage('Empresa criada na Academy.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar a empresa.')
    }
  }

  async function handleAddMember(event: FormEvent) {
    event.preventDefault()
    if (!selectedCompanyId) return
    setMessage('Adicionando colaborador...')
    try {
      await addCompanyMember(selectedCompanyId, memberForm)
      setMemberForm({ userId: '', displayName: '', employeeCode: '', jobTitle: '' })
      await refreshCompany(selectedCompanyId)
      await refreshCompanies(selectedCompanyId)
      setMessage('Colaborador adicionado à empresa.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível adicionar o colaborador.')
    }
  }

  async function handleAssign(event: FormEvent) {
    event.preventDefault()
    if (!selectedCompanyId || !assignmentForm.memberId || !assignmentForm.courseId) return
    setMessage('Atribuindo curso e garantindo matrícula...')
    try {
      const result = await assignCompanyCourse({
        companyId: selectedCompanyId,
        memberId: assignmentForm.memberId,
        courseId: assignmentForm.courseId,
        required: assignmentForm.required,
        dueAt: assignmentForm.dueAt || undefined,
      })
      await refreshCompany(selectedCompanyId)
      await refreshCompanies(selectedCompanyId)
      setMessage(result.idempotent ? 'Este curso já estava atribuído ao colaborador.' : 'Curso atribuído e matrícula conciliada.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atribuir o curso.')
    }
  }

  async function handleCancelAssignment(assignmentId: string) {
    if (!window.confirm('Cancelar esta atribuição corporativa? A matrícula não será removida automaticamente.')) return
    try {
      await cancelCompanyAssignment(assignmentId)
      if (selectedCompanyId) await refreshCompany(selectedCompanyId)
      setMessage('Atribuição cancelada. A matrícula foi preservada por segurança de entitlement.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível cancelar a atribuição.')
    }
  }

  return (
    <div className="enterprisePage">
      <div className="pageHeader">
        <div>
          <h1>Área empresarial</h1>
          <p>Colaboradores, cursos obrigatórios, prazos, progresso e certificados por empresa.</p>
          <small>{loading ? 'Carregando operação empresarial...' : serverAvailable ? 'Operação B2B conectada ao backend' : 'Backend empresarial indisponível neste ambiente'}</small>
          {message && <small className="enterpriseMessage">{message}</small>}
        </div>
      </div>

      {!serverAvailable ? (
        <section className="panel enterpriseOffline">
          <h2>Área empresarial preparada</h2>
          <p>A interface utilizará o identity boundary e o D1 exclusivos da Academy assim que o ambiente STAGE estiver provisionado. Nenhum login paralelo foi criado.</p>
        </section>
      ) : (
        <>
          <section className="enterpriseTopGrid">
            <form className="panel enterpriseForm" onSubmit={handleCreateCompany}>
              <div className="panelTitle"><h2>Nova empresa</h2></div>
              <label>Nome<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Empresa, fazenda ou instituição" /></label>
              <label>Identificação documental<input value={companyDocument} onChange={(event) => setCompanyDocument(event.target.value)} placeholder="Opcional" /></label>
              <button className="primary" type="submit">Cadastrar empresa</button>
            </form>

            <section className="panel enterpriseSelector">
              <div className="panelTitle"><h2>Empresa selecionada</h2></div>
              <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)}>
                {!companies.length && <option value="">Nenhuma empresa cadastrada</option>}
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
              {selectedCompany && <p>{selectedCompany.activeMembers} colaboradores ativos · {selectedCompany.assignments} atribuições registradas</p>}
            </section>
          </section>

          {selectedCompany && summary && (
            <section className="enterpriseMetrics">
              <article><span>Colaboradores</span><strong>{summary.activeMembers}</strong></article>
              <article><span>Atribuições ativas</span><strong>{summary.assignments}</strong></article>
              <article><span>Conclusão</span><strong>{summary.completionPercent}%</strong></article>
              <article><span>Em atraso</span><strong>{summary.overdueAssignments}</strong></article>
              <article><span>Certificados válidos</span><strong>{summary.validCertificates}</strong></article>
            </section>
          )}

          {selectedCompany && (
            <div className="enterpriseOperations">
              <form className="panel enterpriseForm" onSubmit={handleAddMember}>
                <div className="panelTitle"><h2>Adicionar colaborador</h2></div>
                <label>iFarm User ID<input required value={memberForm.userId} onChange={(event) => setMemberForm({ ...memberForm, userId: event.target.value })} placeholder="Identidade existente no iFarm" /></label>
                <label>Nome<input required value={memberForm.displayName} onChange={(event) => setMemberForm({ ...memberForm, displayName: event.target.value })} /></label>
                <label>Código interno<input value={memberForm.employeeCode} onChange={(event) => setMemberForm({ ...memberForm, employeeCode: event.target.value })} /></label>
                <label>Cargo / função<input value={memberForm.jobTitle} onChange={(event) => setMemberForm({ ...memberForm, jobTitle: event.target.value })} /></label>
                <button className="primary" type="submit">Adicionar colaborador</button>
              </form>

              <form className="panel enterpriseForm" onSubmit={handleAssign}>
                <div className="panelTitle"><h2>Atribuir curso</h2></div>
                <label>Colaborador<select required value={assignmentForm.memberId} onChange={(event) => setAssignmentForm({ ...assignmentForm, memberId: event.target.value })}><option value="">Selecione</option>{members.filter((item) => item.status === 'active').map((member) => <option key={member.id} value={member.id}>{member.displayName}{member.jobTitle ? ` · ${member.jobTitle}` : ''}</option>)}</select></label>
                <label>Curso publicado<select required value={assignmentForm.courseId} onChange={(event) => setAssignmentForm({ ...assignmentForm, courseId: event.target.value })}><option value="">Selecione</option>{catalog.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
                <label>Prazo<input type="datetime-local" value={assignmentForm.dueAt} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueAt: event.target.value })} /></label>
                <label className="enterpriseCheck"><input type="checkbox" checked={assignmentForm.required} onChange={(event) => setAssignmentForm({ ...assignmentForm, required: event.target.checked })} /> Treinamento obrigatório</label>
                <button className="primary" type="submit" disabled={!members.length || !catalog.length}>Atribuir e matricular</button>
              </form>
            </div>
          )}

          {selectedCompany && (
            <section className="panel enterpriseTablePanel">
              <div className="panelTitle"><h2>Acompanhamento de treinamentos</h2><span>{assignments.filter((item) => item.status !== 'cancelled').length} ativos</span></div>
              <div className="enterpriseTable">
                <div className="enterpriseTableHead"><span>Colaborador</span><span>Curso</span><span>Prazo</span><span>Status</span><span>Certificado</span><span>Ação</span></div>
                {assignments.map((assignment) => (
                  <div className={`enterpriseTableRow ${assignment.overdue ? 'overdue' : ''}`} key={assignment.id}>
                    <div><strong>{assignment.displayName}</strong><small>{assignment.jobTitle || assignment.employeeCode || assignment.userId}</small></div>
                    <div><strong>{assignment.courseTitle}</strong><small>{assignment.required ? 'Obrigatório' : 'Opcional'}</small></div>
                    <span>{formatDate(assignment.dueAt)}</span>
                    <div><strong>{statusLabel[assignment.effectiveStatus]}</strong>{assignment.overdue && <small>Prazo vencido</small>}</div>
                    <div>{assignment.certificateCode ? <a href={`/certificates/validate?code=${encodeURIComponent(assignment.certificateCode)}`} target="_blank" rel="noopener noreferrer">{assignment.certificateCode}</a> : <span>—</span>}</div>
                    <div>{assignment.status !== 'cancelled' && assignment.effectiveStatus !== 'completed' ? <button onClick={() => void handleCancelAssignment(assignment.id)}>Cancelar</button> : <span>—</span>}</div>
                  </div>
                ))}
                {!assignments.length && <div className="enterpriseEmpty">Nenhum curso atribuído nesta empresa.</div>}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
