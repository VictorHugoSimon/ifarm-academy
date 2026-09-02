import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  downloadCsv,
  loadAcademyReports,
  loadCertificateValidityReport,
  type AcademyReportResponse,
  type CertificateValidityReportResponse,
} from '../services/reportApi'
import '../styles/reports.css'

function inputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatNumber(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}%`
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR')
}

function Kpi({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <article className="reportKpi"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>
}

export function ReportsPage() {
  const today = useMemo(() => new Date(), [])
  const [from, setFrom] = useState(inputDate(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)))
  const [to, setTo] = useState(inputDate(today))
  const [data, setData] = useState<AcademyReportResponse | null>(null)
  const [validity, setValidity] = useState<CertificateValidityReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [serverAvailable, setServerAvailable] = useState(true)
  const [message, setMessage] = useState('')

  async function refresh(nextFrom = from, nextTo = to) {
    setLoading(true)
    setMessage('')
    try {
      const [report, validityReport] = await Promise.all([
        loadAcademyReports(nextFrom, nextTo),
        loadCertificateValidityReport(),
      ])
      setData(report)
      setValidity(validityReport)
      setServerAvailable(true)
    } catch (error) {
      setServerAvailable(false)
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os relatórios.')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    void refresh(from, to)
    // primeira carga apenas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFilter(event: FormEvent) {
    event.preventDefault()
    void refresh(from, to)
  }

  const academic = data?.academic
  const enterprise = data?.enterprise
  const events = data?.events
  const governance = data?.technicalGovernance

  return (
    <div className="reportsPage">
      <header className="pageHeader reportsHeader">
        <div><small>iFarm Academy · Analytics</small><h1>Relatórios e indicadores</h1><p>Visão acadêmica, empresarial, eventos, certificados e cobertura de governança técnica, sempre segregada pelo tenant autenticado.</p></div>
        {data && <div className="reportsGenerated">Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')}</div>}
      </header>

      <form className="panel reportsFilter" onSubmit={handleFilter}>
        <label>De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button className="primary" type="submit" disabled={loading}>{loading ? 'Atualizando...' : 'Aplicar período'}</button>
        {data && <span>Período: {data.window.label}</span>}
      </form>

      {!serverAvailable ? <section className="panel reportsOffline"><h2>Relatórios preparados</h2><p>Esta área depende do D1 e do identity boundary da Academy. Nenhuma métrica demonstrativa é apresentada como dado real.</p>{message && <small>{message}</small>}</section> : !data ? <section className="panel reportsOffline"><p>Carregando indicadores...</p></section> : <>
        <section className="reportsSection">
          <div className="reportsSectionTitle"><div><small>Acadêmico</small><h2>Aprendizagem e certificação</h2></div><button onClick={() => downloadCsv(`ifarm-academy-academico-${from}-${to}.csv`, academic!.courses as unknown as Array<Record<string, unknown>>)}>Exportar CSV</button></div>
          <div className="reportKpiGrid">
            <Kpi label="Cursos publicados" value={academic!.kpis.publishedCourses} /><Kpi label="Alunos únicos" value={academic!.kpis.learners} /><Kpi label="Ciclos ativos" value={academic!.kpis.activeCycles} /><Kpi label="Matrículas no período" value={academic!.kpis.enrollmentsInPeriod} /><Kpi label="Conclusões no período" value={academic!.kpis.completedCyclesInPeriod} /><Kpi label="Certificados no período" value={academic!.kpis.certificatesInPeriod} /><Kpi label="Aprovação em avaliações" value={formatPercent(academic!.kpis.assessmentApprovalRate)} /><Kpi label="Nota média" value={formatNumber(academic!.kpis.averageAssessmentScore)} />
          </div>
          <div className="panel reportTablePanel"><div className="reportTable reportAcademicTable"><div className="reportTableHead"><span>Curso</span><span>Status</span><span>Ciclos</span><span>Concluídos</span><span>Conclusão</span><span>Certificados</span><span>Nota média</span></div>{academic!.courses.map((course) => <div className="reportTableRow" key={course.courseId}><div><strong>{course.courseTitle}</strong><small>{course.certificateType}</small></div><span>{course.status}</span><span>{course.cycles}</span><span>{course.completedCycles}</span><span>{formatPercent(course.completionRate)}</span><span>{course.certificates}</span><span>{formatNumber(course.averageScore)}</span></div>)}{!academic!.courses.length && <div className="reportEmpty">Nenhum curso com dados no período selecionado.</div>}</div></div>
        </section>

        <section className="reportsSection">
          <div className="reportsSectionTitle"><div><small>Empresas</small><h2>Educação corporativa</h2></div><button onClick={() => downloadCsv(`ifarm-academy-empresas-${from}-${to}.csv`, enterprise!.companies as unknown as Array<Record<string, unknown>>)}>Exportar CSV</button></div>
          <div className="reportKpiGrid"><Kpi label="Empresas ativas" value={enterprise!.kpis.activeCompanies} /><Kpi label="Colaboradores ativos" value={enterprise!.kpis.activeMembers} /><Kpi label="Atribuições abertas" value={enterprise!.kpis.openAssignments} /><Kpi label="Atribuições atrasadas" value={enterprise!.kpis.overdueAssignments} /><Kpi label="Conclusões no período" value={enterprise!.kpis.completedAssignmentsInPeriod} /><Kpi label="Conclusão acumulada" value={formatPercent(enterprise!.kpis.completionRate)} /><Kpi label="Renovações vencidas" value={enterprise!.kpis.renewalsDue} /><Kpi label="Renovações próximas" value={enterprise!.kpis.renewalsUpcoming} /></div>
          <div className="panel reportTablePanel"><div className="reportTable reportCompanyTable"><div className="reportTableHead"><span>Empresa</span><span>Colaboradores</span><span>Atribuições</span><span>Concluídas</span><span>Conclusão</span><span>Atrasadas</span><span>Trilhas</span></div>{enterprise!.companies.map((company) => <div className="reportTableRow" key={company.companyId}><div><strong>{company.companyName}</strong><small>{company.status}</small></div><span>{company.activeMembers}</span><span>{company.assignments}</span><span>{company.completedAssignments}</span><span>{formatPercent(company.completionRate)}</span><span>{company.overdueAssignments}</span><span>{company.pathAssignments}</span></div>)}{!enterprise!.companies.length && <div className="reportEmpty">Nenhuma empresa cadastrada neste tenant.</div>}</div></div>
        </section>

        <section className="reportsSection">
          <div className="reportsSectionTitle"><div><small>Eventos</small><h2>Smart Farm Experience e capacitações</h2></div><button onClick={() => downloadCsv(`ifarm-academy-eventos-${from}-${to}.csv`, events!.events as unknown as Array<Record<string, unknown>>)}>Exportar CSV</button></div>
          <div className="reportKpiGrid"><Kpi label="Próximos eventos" value={events!.kpis.upcomingEvents} /><Kpi label="Smart Farm próximos" value={events!.kpis.smartFarmUpcoming} /><Kpi label="Inscrições no período" value={events!.kpis.registrationsInPeriod} /><Kpi label="Lista de espera atual" value={events!.kpis.currentWaitlist} /><Kpi label="Taxa de presença" value={formatPercent(events!.kpis.attendanceRate)} /><Kpi label="Presenças registradas" value={events!.kpis.attendedInCompletedEvents} /><Kpi label="Ausências registradas" value={events!.kpis.noShowInCompletedEvents} /></div>
          <div className="panel reportTablePanel"><div className="reportTable reportEventTable"><div className="reportTableHead"><span>Evento</span><span>Data</span><span>Modelo</span><span>Ocupação</span><span>Fila</span><span>Presentes</span><span>Smart Farm</span></div>{events!.events.map((event) => <div className="reportTableRow" key={event.eventId}><div><strong>{event.title}</strong><small>{event.eventType} · {event.modality}</small></div><span>{formatDate(event.startsAt)}</span><span>{event.accessModel}</span><span>{event.capacity == null ? `${event.occupied}` : `${event.occupied}/${event.capacity} · ${formatPercent(event.occupancyRate)}`}</span><span>{event.waitlisted}</span><span>{event.attended}</span><span>{event.smartFarmExperience ? 'Sim' : 'Não'}</span></div>)}{!events!.events.length && <div className="reportEmpty">Nenhum evento registrado.</div>}</div></div>
        </section>

        <section className="reportsSection">
          <div className="reportsSectionTitle"><div><small>Governança técnica</small><h2>Treinamentos regulatórios e responsáveis</h2></div><button onClick={() => downloadCsv(`ifarm-academy-governanca-tecnica-${from}-${to}.csv`, governance!.courses as unknown as Array<Record<string, unknown>>)}>Exportar CSV</button></div>
          <div className="reportKpiGrid"><Kpi label="Cursos regulatórios" value={governance!.kpis.regulatoryCourses} /><Kpi label="Publicados sem responsável vigente" value={governance!.kpis.regulatoryCoursesMissingCurrentResponsible} /><Kpi label="Qualificações verificadas" value={governance!.kpis.verifiedCurrentQualifications} /><Kpi label="Vencem em 30 dias" value={governance!.kpis.qualificationsExpiringIn30Days} /><Kpi label="Qualificações vencidas" value={governance!.kpis.expiredQualifications} /><Kpi label="Responsabilidades técnicas vigentes" value={governance!.kpis.activeVerifiedTechnicalResponsibilities} /><Kpi label="Certificados regulatórios no período" value={governance!.kpis.regulatoryCertificatesInPeriod} /></div>
          <div className="reportsDisclaimer">{governance!.disclaimer}</div>
          <div className="panel reportTablePanel"><div className="reportTable reportGovernanceTable"><div className="reportTableHead"><span>Curso regulatório</span><span>Status</span><span>Responsáveis ativos</span><span>Responsáveis vigentes</span><span>Cobertura técnica</span></div>{governance!.courses.map((course) => <div className={`reportTableRow ${course.status === 'published' && !course.technicalGovernanceCovered ? 'attention' : ''}`} key={course.courseId}><strong>{course.courseTitle}</strong><span>{course.status}</span><span>{course.technicalResponsibles}</span><span>{course.currentVerifiedResponsibles}</span><span>{course.technicalGovernanceCovered ? 'Coberta' : 'Revisão necessária'}</span></div>)}{!governance!.courses.length && <div className="reportEmpty">Nenhum curso marcado como treinamento regulatório.</div>}</div></div>
        </section>

        {validity && <section className="reportsSection">
          <div className="reportsSectionTitle"><div><small>Validade de certificados</small><h2>Treinamentos regulatórios</h2></div><button onClick={() => downloadCsv('ifarm-academy-validade-certificados.csv', [...validity.expiring, ...validity.missingPolicy] as unknown as Array<Record<string, unknown>>)}>Exportar CSV</button></div>
          <div className="reportKpiGrid"><Kpi label="Certificados regulatórios" value={validity.kpis.regulatoryCertificates} /><Kpi label="Expirados" value={validity.kpis.expired} /><Kpi label="Expiram em 30 dias" value={validity.kpis.expiringIn30Days} /><Kpi label="Revogados" value={validity.kpis.revoked} /><Kpi label="Sem política no snapshot" value={validity.kpis.withoutValidityPolicySnapshot} /><Kpi label="Política por meses" value={validity.kpis.fixedMonthsPolicySnapshot} /><Kpi label="Sem expiração registrada" value={validity.kpis.indefinitePolicySnapshot} /></div>
          <div className="reportsDisclaimer">{validity.disclaimer}</div>
          <div className="reportsValidityColumns">
            <div className="panel reportTablePanel"><div className="reportTable reportValidityTable"><div className="reportTableHead"><span>Expira em breve</span><span>Aluno</span><span>Validade</span></div>{validity.expiring.map((item) => <div className="reportTableRow" key={item.publicCode}><div><strong>{item.courseTitle}</strong><small>{item.publicCode}</small></div><span>{item.studentName}</span><span>{formatDate(item.validUntil)}</span></div>)}{!validity.expiring.length && <div className="reportEmpty">Nenhum certificado regulatório expira nos próximos 30 dias.</div>}</div></div>
            <div className="panel reportTablePanel"><div className="reportTable reportValidityTable"><div className="reportTableHead"><span>Sem política temporal</span><span>Aluno</span><span>Emissão</span></div>{validity.missingPolicy.map((item) => <div className="reportTableRow attention" key={item.publicCode}><div><strong>{item.courseTitle}</strong><small>{item.publicCode}</small></div><span>{item.studentName}</span><span>{formatDate(item.issuedAt)}</span></div>)}{!validity.missingPolicy.length && <div className="reportEmpty">Nenhum certificado regulatório sem política temporal no snapshot.</div>}</div></div>
          </div>
        </section>}
      </>}
    </div>
  )
}
