import { useEffect, useState } from 'react'
import {
  loadHealth,
  loadOperationsStatus,
  loadReadiness,
  type HealthStatus,
  type OperationsStatus,
  type ReadinessStatus,
} from '../services/operationsApi'
import '../styles/operations.css'

function booleanLabel(value: boolean) {
  return value ? 'OK' : 'Falha'
}

export function OperationsPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [readiness, setReadiness] = useState<ReadinessStatus | null>(null)
  const [operations, setOperations] = useState<OperationsStatus | null>(null)
  const [message, setMessage] = useState('Carregando estado operacional...')

  async function refresh() {
    setMessage('Atualizando...')
    const [healthResult, readinessResult, operationsResult] = await Promise.allSettled([
      loadHealth(),
      loadReadiness(),
      loadOperationsStatus(),
    ])

    if (healthResult.status === 'fulfilled') setHealth(healthResult.value)
    if (readinessResult.status === 'fulfilled') setReadiness(readinessResult.value)
    else setReadiness(null)
    if (operationsResult.status === 'fulfilled') setOperations(operationsResult.value)
    else setOperations(null)

    if (healthResult.status === 'rejected') setMessage('Health indisponível.')
    else if (readinessResult.status === 'rejected') setMessage('Aplicação viva, porém readiness não está aprovado.')
    else if (operationsResult.status === 'rejected') setMessage('Health/readiness disponíveis; painel administrativo depende da identidade confiável.')
    else setMessage('Estado operacional atualizado.')
  }

  useEffect(() => { void refresh() }, [])

  return (
    <div className="operationsPage">
      <header className="pageHeader operationsHeader">
        <div>
          <small>iFarm Academy · Operações</small>
          <h1>Saúde e observabilidade</h1>
          <p>Liveness, readiness, rate limiting e eventos operacionais sem exposição de secrets ou dados pessoais.</p>
        </div>
        <button className="primary" onClick={() => void refresh()}>Atualizar</button>
      </header>

      <div className="operationsMessage">{message}</div>

      <section className="operationsKpis">
        <article><span>Liveness</span><strong>{health?.status === 'ok' ? 'OK' : 'Indisponível'}</strong><small>{health?.release ?? 'release desconhecida'}</small></article>
        <article><span>Readiness</span><strong>{readiness?.status === 'ready' ? 'Pronto' : 'Não pronto'}</strong><small>{readiness?.environment ?? health?.environment ?? 'ambiente desconhecido'}</small></article>
        <article><span>Rate limiting</span><strong>{operations ? (operations.rateLimiting.enabled ? 'Ativo' : 'Desativado') : '—'}</strong><small>{operations ? `${operations.rateLimiting.activeBucketsLast5Minutes} buckets ativos em 5 min` : 'painel administrativo indisponível'}</small></article>
        <article><span>Eventos em 24h</span><strong>{operations?.last24Hours.grouped.reduce((sum, item) => sum + item.total, 0) ?? '—'}</strong><small>somente eventos operacionais relevantes</small></article>
      </section>

      <section className="panel operationsChecks">
        <div className="operationsSectionTitle"><small>Dependências</small><h2>Readiness</h2></div>
        {readiness ? (
          <div className="operationsCheckGrid">
            <div><span>Banco D1</span><strong>{booleanLabel(readiness.checks.database)}</strong></div>
            <div><span>Identity boundary</span><strong>{booleanLabel(readiness.checks.identityBoundary)}</strong></div>
            <div><span>Storage requerido</span><strong>{booleanLabel(readiness.checks.storage)}</strong></div>
          </div>
        ) : <p>Readiness não pôde ser confirmado neste ambiente.</p>}
      </section>

      <section className="panel operationsEvents">
        <div className="operationsSectionTitle"><small>Observabilidade</small><h2>Eventos operacionais recentes</h2></div>
        {!operations ? <p>O endpoint administrativo requer o boundary de identidade da iFarm.</p> : (
          <>
            <div className="operationsGrouped">
              {operations.last24Hours.grouped.map((item) => (
                <div key={`${item.eventType}-${item.severity}`}>
                  <span>{item.eventType}</span><strong>{item.total}</strong><small>{item.severity}</small>
                </div>
              ))}
              {!operations.last24Hours.grouped.length && <p>Nenhum evento operacional relevante nas últimas 24 horas.</p>}
            </div>
            <div className="operationsEventTable">
              <div className="operationsEventHead"><span>Horário</span><span>Evento</span><span>Componente</span><span>Status</span><span>Request ID</span></div>
              {operations.last24Hours.recent.map((event, index) => (
                <div className="operationsEventRow" key={`${event.createdAt}-${event.requestId ?? index}`}>
                  <span>{new Date(event.createdAt).toLocaleString('pt-BR')}</span>
                  <div><strong>{event.eventType}</strong><small>{event.detailCode ?? event.severity}</small></div>
                  <span>{event.component}</span>
                  <span>{event.statusCode ?? '—'}</span>
                  <code>{event.requestId ?? '—'}</code>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="operationsNotice">Logs estruturados não registram corpo de requisição, secrets, e-mail, nome do usuário ou identificadores pessoais. Alertas externos e backup real só serão ativados após o STAGE exclusivo estar provisionado.</div>
    </div>
  )
}
