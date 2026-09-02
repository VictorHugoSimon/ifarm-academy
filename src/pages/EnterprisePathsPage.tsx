import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  assignCompanyLearningPath,
  createCompanyLearningPath,
  inactivateCompanyLearningPath,
  loadCompanies,
  loadCompanyLearningPaths,
  loadCompanyMembers,
  loadCompanyPathAssignments,
  loadCompanyRenewals,
  loadEnterpriseCatalog,
  startCompanyRenewalCycle,
  type CompanyLearningPathRecord,
  type CompanyMemberRecord,
  type CompanyPathAssignmentRecord,
  type CompanyRecord,
  type CompanyRenewalResponse,
} from '../services/enterpriseApi'
import type { CatalogCourse } from '../services/enrollmentApi'
import '../styles/enterprise.css'

function formatDate(value?: string | null) {
  if (!value) return 'Sem prazo'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR')
}

const pathStatusLabel: Record<CompanyPathAssignmentRecord['effectiveStatus'], string> = {
  assigned: 'Atribuída',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

export function EnterprisePathsPage() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [companyId, setCompanyId] = useState('')
  const [members, setMembers] = useState<CompanyMemberRecord[]>([])
  const [catalog, setCatalog] = useState<CatalogCourse[]>([])
  const [paths, setPaths] = useState<CompanyLearningPathRecord[]>([])
  const [assignments, setAssignments] = useState<CompanyPathAssignmentRecord[]>([])
  const [renewals, setRenewals] = useState<CompanyRenewalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [serverAvailable, setServerAvailable] = useState(true)
  const [message, setMessage] = useState('')
  const [renewalStartingId, setRenewalStartingId] = useState('')

  const [pathForm, setPathForm] = useState({
    name: '', description: '', defaultRenewalMonths: '', selectedCourses: [] as string[],
  })
  const [assignmentForm, setAssignmentForm] = useState({ memberId: '', pathId: '', dueAt: '' })

  const selectedCompany = useMemo(() => companies.find((item) => item.id === companyId) ?? null, [companies, companyId])
  const activePaths = useMemo(() => paths.filter((item) => item.status === 'active'), [paths])

  async function refreshCompany(currentCompanyId: string) {
    if (!currentCompanyId) return
    const [memberItems, pathItems, pathAssignmentItems, renewalData] = await Promise.all([
      loadCompanyMembers(currentCompanyId),
      loadCompanyLearningPaths(currentCompanyId),
      loadCompanyPathAssignments(currentCompanyId),
      loadCompanyRenewals(currentCompanyId),
    ])
    setMembers(memberItems)
    setPaths(pathItems)
    setAssignments(pathAssignmentItems)
    setRenewals(renewalData)
    setAssignmentForm((current) => ({
      ...current,
      memberId: memberItems.some((item) => item.id === current.memberId) ? current.memberId : memberItems[0]?.id ?? '',
      pathId: pathItems.some((item) => item.id === current.pathId && item.status === 'active') ? current.pathId : pathItems.find((item) => item.status === 'active')?.id ?? '',
    }))
  }

  useEffect(() => {
    let cancelled = false
    void Promise.all([loadCompanies(), loadEnterpriseCatalog()])
      .then(([companyItems, courseItems]) => {
        if (cancelled) return
        setCompanies(companyItems)
        setCatalog(courseItems)
        setCompanyId(companyItems[0]?.id ?? '')
        setServerAvailable(true)
      })
      .catch(() => { if (!cancelled) setServerAvailable(false) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!serverAvailable || !companyId) return
    void refreshCompany(companyId).catch((error) => setMessage(error instanceof Error ? error.message : 'Falha ao carregar trilhas empresariais.'))
  }, [companyId, serverAvailable])

  function toggleCourse(courseId: string) {
    setPathForm((current) => ({
      ...current,
      selectedCourses: current.selectedCourses.includes(courseId)
        ? current.selectedCourses.filter((item) => item !== courseId)
        : [...current.selectedCourses, courseId],
    }))
  }

  async function handleCreatePath(event: FormEvent) {
    event.preventDefault()
    if (!companyId || !pathForm.name.trim() || !pathForm.selectedCourses.length) return
    const renewalMonths = pathForm.defaultRenewalMonths ? Number(pathForm.defaultRenewalMonths) : null
    setMessage('Criando trilha empresarial...')
    try {
      await createCompanyLearningPath({
        companyId,
        name: pathForm.name.trim(),
        description: pathForm.description.trim() || undefined,
        defaultRenewalMonths: renewalMonths,
        courses: pathForm.selectedCourses.map((courseId) => ({ courseId, required: true, renewalMonths: null })),
      })
      setPathForm({ name: '', description: '', defaultRenewalMonths: '', selectedCourses: [] })
      await refreshCompany(companyId)
      setMessage('Trilha empresarial criada. Periodicidade registrada somente quando configurada explicitamente.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar a trilha.')
    }
  }

  async function handleAssignPath(event: FormEvent) {
    event.preventDefault()
    if (!companyId || !assignmentForm.memberId || !assignmentForm.pathId) return
    setMessage('Atribuindo trilha e conciliando matrículas...')
    try {
      const result = await assignCompanyLearningPath({
        companyId,
        memberId: assignmentForm.memberId,
        pathId: assignmentForm.pathId,
        dueAt: assignmentForm.dueAt || undefined,
      })
      await refreshCompany(companyId)
      setMessage(result.idempotent ? 'A trilha já estava aberta para este colaborador.' : 'Trilha atribuída sem duplicar matrículas ou cursos já existentes.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atribuir a trilha.')
    }
  }

  async function handleInactivatePath(pathId: string) {
    if (!window.confirm('Inativar esta trilha? O histórico das atribuições será preservado.')) return
    try {
      await inactivateCompanyLearningPath(pathId)
      await refreshCompany(companyId)
      setMessage('Trilha inativada. Histórico acadêmico e corporativo preservado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível inativar a trilha.')
    }
  }

  async function handleStartRenewalCycle(assignmentId: string) {
    if (!window.confirm('Iniciar um novo ciclo de treinamento? O novo ciclo começa com progresso, tentativas e certificado zerados. O histórico anterior será preservado.')) return
    setRenewalStartingId(assignmentId)
    setMessage('Criando novo ciclo auditável...')
    try {
      const result = await startCompanyRenewalCycle({ assignmentId })
      await refreshCompany(companyId)
      setMessage(`Novo ciclo ${result.data.cycleNumber} iniciado para ${result.data.courseTitle}. Estado acadêmico anterior preservado.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível iniciar o novo ciclo.')
    } finally {
      setRenewalStartingId('')
    }
  }

  return (
    <div className="enterprisePage">
      <div className="pageHeader">
        <div>
          <h1>Trilhas empresariais</h1>
          <p>Capacitação obrigatória, acompanhamento por colaborador e ciclos recorrentes auditáveis.</p>
          <small>{loading ? 'Carregando...' : serverAvailable ? 'Trilhas conectadas ao backend da Academy' : 'Backend indisponível neste ambiente'}</small>
          {message && <small className="enterpriseMessage">{message}</small>}
        </div>
      </div>

      {!serverAvailable ? (
        <section className="panel enterpriseOffline"><h2>Operação preparada</h2><p>Esta área depende do D1 e do identity boundary da Academy em STAGE. Nenhuma identidade paralela é criada.</p></section>
      ) : (
        <>
          <section className="panel enterpriseSelector enterprisePathSelector">
            <div className="panelTitle"><h2>Empresa</h2></div>
            <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              {!companies.length && <option value="">Nenhuma empresa cadastrada</option>}
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
            {selectedCompany && <p>{selectedCompany.name} · {members.filter((item) => item.status === 'active').length} colaboradores ativos</p>}
          </section>

          {selectedCompany && (
            <section className="enterprisePathMetrics">
              <article><span>Trilhas ativas</span><strong>{activePaths.length}</strong></article>
              <article><span>Atribuições de trilha</span><strong>{assignments.filter((item) => item.status !== 'cancelled').length}</strong></article>
              <article><span>Renovações vencidas</span><strong>{renewals?.summary.due ?? 0}</strong></article>
              <article><span>Prontas para novo ciclo</span><strong>{renewals?.summary.readyToStart ?? 0}</strong></article>
            </section>
          )}

          {selectedCompany && (
            <div className="enterpriseOperations enterprisePathOperations">
              <form className="panel enterpriseForm enterprisePathForm" onSubmit={handleCreatePath}>
                <div className="panelTitle"><h2>Nova trilha obrigatória</h2></div>
                <label>Nome<input required value={pathForm.name} onChange={(event) => setPathForm({ ...pathForm, name: event.target.value })} placeholder="Ex.: Integração operacional da fazenda" /></label>
                <label>Descrição<textarea value={pathForm.description} onChange={(event) => setPathForm({ ...pathForm, description: event.target.value })} placeholder="Objetivo e público da trilha" /></label>
                <label>Periodicidade padrão em meses<input type="number" min="1" max="120" value={pathForm.defaultRenewalMonths} onChange={(event) => setPathForm({ ...pathForm, defaultRenewalMonths: event.target.value })} placeholder="Opcional — não inferida pela Academy" /></label>
                <div className="enterpriseCoursePicker">
                  <strong>Cursos publicados</strong>
                  <small>Selecione os cursos que compõem a trilha. Todos entram como obrigatórios nesta primeira versão.</small>
                  {catalog.map((course) => (
                    <label key={course.id}><input type="checkbox" checked={pathForm.selectedCourses.includes(course.id)} onChange={() => toggleCourse(course.id)} /> <span>{course.title}</span></label>
                  ))}
                </div>
                <button className="primary" type="submit" disabled={!pathForm.selectedCourses.length}>Criar trilha</button>
              </form>

              <form className="panel enterpriseForm" onSubmit={handleAssignPath}>
                <div className="panelTitle"><h2>Atribuir trilha</h2></div>
                <label>Colaborador<select required value={assignmentForm.memberId} onChange={(event) => setAssignmentForm({ ...assignmentForm, memberId: event.target.value })}><option value="">Selecione</option>{members.filter((item) => item.status === 'active').map((member) => <option key={member.id} value={member.id}>{member.displayName}{member.jobTitle ? ` · ${member.jobTitle}` : ''}</option>)}</select></label>
                <label>Trilha<select required value={assignmentForm.pathId} onChange={(event) => setAssignmentForm({ ...assignmentForm, pathId: event.target.value })}><option value="">Selecione</option>{activePaths.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}</select></label>
                <label>Prazo da trilha<input type="datetime-local" value={assignmentForm.dueAt} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueAt: event.target.value })} /></label>
                <div className="enterprisePolicyNote">Cursos já atribuídos são reutilizados. Conclusões antigas permanecem preservadas como ciclos históricos.</div>
                <button className="primary" type="submit" disabled={!members.length || !activePaths.length}>Atribuir trilha</button>
              </form>
            </div>
          )}

          {selectedCompany && (
            <section className="panel enterpriseTablePanel">
              <div className="panelTitle"><h2>Trilhas configuradas</h2><span>{paths.length} registradas</span></div>
              <div className="enterprisePathCards">
                {paths.map((path) => (
                  <article key={path.id} className={path.status === 'inactive' ? 'inactive' : ''}>
                    <div><strong>{path.name}</strong><small>{path.description || 'Sem descrição'}</small></div>
                    <span>{path.courses.length} cursos</span>
                    <span>{path.defaultRenewalMonths ? `Renovação padrão: ${path.defaultRenewalMonths} meses` : 'Sem periodicidade padrão'}</span>
                    <span>{path.assignments} atribuições</span>
                    {path.status === 'active' ? <button onClick={() => void handleInactivatePath(path.id)}>Inativar</button> : <span>Inativa</span>}
                  </article>
                ))}
                {!paths.length && <div className="enterpriseEmpty">Nenhuma trilha empresarial cadastrada.</div>}
              </div>
            </section>
          )}

          {selectedCompany && (
            <section className="panel enterpriseTablePanel">
              <div className="panelTitle"><h2>Progresso das trilhas</h2><span>{assignments.length} atribuições</span></div>
              <div className="enterpriseTable enterprisePathTable">
                <div className="enterpriseTableHead"><span>Colaborador</span><span>Trilha</span><span>Progresso</span><span>Prazo</span><span>Status</span><span>Cursos</span></div>
                {assignments.map((assignment) => (
                  <div className={`enterpriseTableRow ${assignment.overdue ? 'overdue' : ''}`} key={assignment.id}>
                    <div><strong>{assignment.displayName}</strong><small>{assignment.jobTitle || assignment.userId}</small></div>
                    <strong>{assignment.pathName}</strong>
                    <div><strong>{assignment.progressPercent}%</strong><small>{assignment.completedCourses}/{assignment.requiredCourses} obrigatórios</small></div>
                    <span>{formatDate(assignment.dueAt)}</span>
                    <div><strong>{pathStatusLabel[assignment.effectiveStatus]}</strong>{assignment.overdue && <small>Prazo vencido</small>}</div>
                    <span>{assignment.courses.length}</span>
                  </div>
                ))}
                {!assignments.length && <div className="enterpriseEmpty">Nenhuma trilha atribuída.</div>}
              </div>
            </section>
          )}

          {selectedCompany && renewals && (
            <section className="panel enterpriseTablePanel enterpriseRenewalPanel">
              <div className="panelTitle"><h2>Renovações de treinamento</h2><span>{renewals.summary.configured} ciclos monitorados</span></div>
              <div className="enterprisePolicyNote">{renewals.policy.note} Um novo ciclo só é aberto na janela de renovação e começa sem reaproveitar progresso, tentativas, notas ou certificado do ciclo anterior.</div>
              <div className="enterpriseRenewalGrid">
                {renewals.data.filter((item) => item.renewalState !== 'not_due').map((item) => (
                  <article key={item.assignmentId} className={item.renewalState}>
                    <div><strong>{item.displayName}</strong><small>{item.jobTitle || item.userId}</small></div>
                    <div><strong>{item.courseTitle}</strong><small>Ciclo acadêmico {item.learningCycleNumber ?? item.renewalCycle} · renovação {item.renewalCycle} · a cada {item.renewalMonths} meses</small></div>
                    <div><span>{item.renewalState === 'due' ? 'Renovação vencida' : 'Renovação próxima'}</span><strong>{formatDate(item.renewalDueAt)}</strong></div>
                    <div className="enterpriseRenewalActions">
                      {item.certificateCode ? <a href={`/certificates/validate?code=${encodeURIComponent(item.certificateCode)}`} target="_blank" rel="noopener noreferrer">Ver certificado anterior</a> : <span>Sem certificado localizado</span>}
                      {item.canStartNewCycle ? (
                        <button className="primary" disabled={Boolean(renewalStartingId)} onClick={() => void handleStartRenewalCycle(item.assignmentId)}>
                          {renewalStartingId === item.assignmentId ? 'Iniciando...' : 'Iniciar novo ciclo'}
                        </button>
                      ) : item.hasOpenAssignment ? <small>Novo ciclo já aberto</small> : <small>Renovação indisponível</small>}
                    </div>
                  </article>
                ))}
                {!renewals.data.some((item) => item.renewalState !== 'not_due') && <div className="enterpriseEmpty">Nenhuma renovação vencida ou prevista para os próximos 30 dias.</div>}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
