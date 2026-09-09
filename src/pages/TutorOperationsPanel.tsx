import { useEffect, useMemo, useState } from 'react'
import {
  archiveTutorUsagePolicy,
  loadTutorOperations,
  loadTutorUsagePolicies,
  saveTutorUsagePolicy,
  type TutorOperations,
  type TutorQuotaPeriod,
  type TutorQuotaScope,
  type TutorUsagePolicy,
} from '../services/tutorApi'

export function TutorOperationsPanel({ courses }: { courses: Array<{ id: string; title: string }> }) {
  const [operations, setOperations] = useState<TutorOperations | null>(null)
  const [history, setHistory] = useState<TutorUsagePolicy[]>([])
  const [days, setDays] = useState(7)
  const [scopeType, setScopeType] = useState<TutorQuotaScope>('tenant')
  const [scopeId, setScopeId] = useState('')
  const [period, setPeriod] = useState<TutorQuotaPeriod>('day')
  const [maxRequests, setMaxRequests] = useState('')
  const [maxChars, setMaxChars] = useState('')
  const [rationale, setRationale] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const activePolicyIds = useMemo(
    () => new Set(operations?.activePolicies.map((item) => item.policy.id) ?? []),
    [operations],
  )

  async function refresh(nextDays = days) {
    const [ops, policies] = await Promise.all([
      loadTutorOperations(nextDays),
      loadTutorUsagePolicies(),
    ])
    setOperations(ops)
    setHistory(policies)
  }

  useEffect(() => {
    void refresh(days).catch((error) => setStatus(error instanceof Error ? error.message : 'Falha ao carregar operação do Tutor.'))
  }, [days])

  useEffect(() => {
    if (scopeType === 'course' && !scopeId && courses[0]) setScopeId(courses[0].id)
    if (scopeType === 'tenant') setScopeId('')
  }, [scopeType, courses, scopeId])

  async function publishPolicy(event: React.FormEvent) {
    event.preventDefault()
    const requests = maxRequests.trim() ? Number(maxRequests) : null
    const chars = maxChars.trim() ? Number(maxChars) : null
    if (requests == null && chars == null) {
      setStatus('Informe limite de chamadas, caracteres de entrada ou ambos.')
      return
    }
    if (scopeType !== 'tenant' && !scopeId.trim()) {
      setStatus(scopeType === 'course' ? 'Selecione um curso.' : 'Informe o ID do aluno.')
      return
    }
    if (rationale.trim().length < 10) {
      setStatus('A justificativa precisa explicar a decisão de uso.')
      return
    }

    setBusy(true)
    setStatus('Publicando nova versão da política de uso...')
    try {
      await saveTutorUsagePolicy({
        scopeType,
        scopeId: scopeType === 'tenant' ? undefined : scopeId.trim(),
        period,
        maxProviderRequests: requests,
        maxRequestChars: chars,
        rationale: rationale.trim(),
      })
      setRationale('')
      setMaxRequests('')
      setMaxChars('')
      await refresh()
      setStatus('Política publicada. A versão anterior do mesmo escopo/período foi arquivada.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível publicar a política.')
    } finally {
      setBusy(false)
    }
  }

  async function archivePolicy(id: string) {
    setBusy(true)
    setStatus('Arquivando política ativa...')
    try {
      await archiveTutorUsagePolicy(id)
      await refresh()
      setStatus('Política arquivada. Geração externa pode ficar bloqueada se não existir outra quota de tenant ativa.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível arquivar a política.')
    } finally {
      setBusy(false)
    }
  }

  const metrics = operations?.metrics
  const recentHistory = history.slice(0, 12)

  return (
    <section className="tutorOperationsPanel">
      <header className="tutorOperationsHeader">
        <div>
          <small>Governança operacional</small>
          <h3>Uso, quotas e guardrails do Tutor</h3>
          <p>Os limites controlam chamadas e caracteres enviados ao gateway. Não representam tokens, custo financeiro ou orçamento contábil.</p>
        </div>
        <label>
          Janela do painel
          <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={1}>24 horas</option>
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
          </select>
        </label>
      </header>

      <div className="tutorMetricsGrid">
        <article><small>Tentativas externas</small><strong>{metrics?.attemptedCalls ?? 0}</strong></article>
        <article><small>Taxa de sucesso</small><strong>{metrics?.successRate ?? 0}%</strong></article>
        <article><small>Latência média</small><strong>{metrics?.averageLatencyMs ?? 0} ms</strong></article>
        <article><small>Caracteres enviados</small><strong>{(metrics?.requestChars ?? 0).toLocaleString('pt-BR')}</strong></article>
        <article><small>Bloqueios por quota</small><strong>{metrics?.quotaBlocks ?? 0}</strong></article>
        <article><small>Riscos de prompt</small><strong>{metrics?.promptRisks ?? 0}</strong></article>
      </div>

      <div className="tutorOpsGrid">
        <form className="tutorQuotaForm" onSubmit={publishPolicy}>
          <h4>Publicar política de uso</h4>
          <p className="tutorHint">Não existe quota padrão. A geração externa exige ao menos uma política ativa no escopo do tenant.</p>
          <label>
            Escopo
            <select value={scopeType} onChange={(event) => setScopeType(event.target.value as TutorQuotaScope)}>
              <option value="tenant">Tenant inteiro</option>
              <option value="course">Curso</option>
              <option value="student">Aluno</option>
            </select>
          </label>
          {scopeType === 'course' && (
            <label>
              Curso
              <select value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
                <option value="">Selecione</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </label>
          )}
          {scopeType === 'student' && (
            <label>
              ID do aluno no iFarm Core
              <input value={scopeId} onChange={(event) => setScopeId(event.target.value)} placeholder="UUID/ID da identidade matriculada" />
            </label>
          )}
          <label>
            Período
            <select value={period} onChange={(event) => setPeriod(event.target.value as TutorQuotaPeriod)}>
              <option value="day">Por dia UTC</option>
              <option value="month">Por mês UTC</option>
            </select>
          </label>
          <div className="tutorQuotaInputs">
            <label>
              Máx. chamadas
              <input type="number" min="1" step="1" value={maxRequests} onChange={(event) => setMaxRequests(event.target.value)} placeholder="Opcional" />
            </label>
            <label>
              Máx. caracteres de entrada
              <input type="number" min="1" step="1" value={maxChars} onChange={(event) => setMaxChars(event.target.value)} placeholder="Opcional" />
            </label>
          </div>
          <label>
            Justificativa da política
            <textarea maxLength={600} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Por que este limite foi aprovado?" />
          </label>
          <button type="submit" disabled={busy}>Publicar nova versão</button>
        </form>

        <div className="tutorQuotaList">
          <h4>Políticas ativas</h4>
          {!operations?.activePolicies.length && <p>Nenhuma política ativa. O provider permanece bloqueado por quota.</p>}
          {operations?.activePolicies.map((item) => (
            <article key={item.policy.id}>
              <div>
                <strong>{item.policy.scopeType} · {item.policy.period} · v{item.policy.version}</strong>
                <small>{item.policy.scopeId || 'tenant inteiro'}</small>
              </div>
              <dl>
                <div><dt>Chamadas</dt><dd>{item.usage.providerRequests} / {item.policy.maxProviderRequests ?? 'sem limite neste eixo'}</dd></div>
                <div><dt>Caracteres</dt><dd>{item.usage.requestChars.toLocaleString('pt-BR')} / {item.policy.maxRequestChars?.toLocaleString('pt-BR') ?? 'sem limite neste eixo'}</dd></div>
              </dl>
              <p>{item.policy.rationale}</p>
              <button type="button" className="secondaryButton" disabled={busy} onClick={() => void archivePolicy(item.policy.id)}>Arquivar</button>
            </article>
          ))}
        </div>
      </div>

      <div className="tutorOpsGrid tutorOpsTables">
        <div>
          <h4>Guardrails na janela</h4>
          {!operations?.guardrails.length && <p>Nenhum bloqueio registrado.</p>}
          {operations?.guardrails.map((row) => (
            <div className="tutorOpsRow" key={`${row.event_type}:${row.reason_code}`}>
              <span>{row.event_type} · {row.reason_code}</span><strong>{row.total}</strong>
            </div>
          ))}
        </div>
        <div>
          <h4>Outcomes do provider</h4>
          {!operations?.outcomes.length && <p>Nenhum evento de provider na janela.</p>}
          {operations?.outcomes.map((row) => (
            <div className="tutorOpsRow" key={row.outcome}><span>{row.outcome}</span><strong>{row.total}</strong></div>
          ))}
        </div>
      </div>

      <details className="tutorPolicyHistory">
        <summary>Histórico recente de políticas</summary>
        {recentHistory.map((policy) => (
          <div className="tutorOpsRow" key={policy.id}>
            <span>{policy.scopeType} · {policy.period} · v{policy.version} · {policy.status}</span>
            <small>{policy.approvedAt ? new Date(policy.approvedAt).toLocaleString('pt-BR') : ''}</small>
          </div>
        ))}
      </details>

      {status && <p className="tutorOpsStatus">{status}</p>}
    </section>
  )
}
