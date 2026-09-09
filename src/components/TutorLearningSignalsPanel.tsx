import { useEffect, useState } from 'react'
import { loadTutorLearningSignals, type TutorLearningSignalsResult } from '../services/tutorLearningSignalsApi'
import '../styles/tutor-learning-signals.css'

type Props = {
  courseId: string
  courseTitle?: string
}

export function TutorLearningSignalsPanel({ courseId, courseTitle }: Props) {
  const [data, setData] = useState<TutorLearningSignalsResult | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    if (!courseId || busy) return
    setBusy(true)
    setStatus('Atualizando recomendações com o estado acadêmico atual...')
    try {
      const result = await loadTutorLearningSignals(courseId)
      setData(result)
      setStatus('Recomendações atualizadas. Nenhum perfil permanente foi criado.')
    } catch (error) {
      setData(null)
      setStatus(error instanceof Error ? error.message : 'Não foi possível calcular recomendações de estudo.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    setData(null)
    setStatus('')
    void refresh()
    // courseId é a fronteira de atualização; refresh usa apenas estado server-side atual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  return (
    <section className="tutorLearningSignals" aria-label="Recomendações de estudo">
      <header>
        <div>
          <small>Learning Signals</small>
          <h3>Próximos passos de estudo {courseTitle ? `— ${courseTitle}` : ''}</h3>
          <p>Recomendações baseadas somente em progresso, aulas obrigatórias e estado de avaliações do seu ciclo atual. Não são diagnóstico, score de capacidade ou perfil comercial.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={busy}>{busy ? 'Atualizando...' : 'Atualizar'}</button>
      </header>

      {data && (
        <div className="tutorSignalMetrics" aria-label="Resumo acadêmico do ciclo">
          <span>Ciclo {data.cycleNumber}</span>
          <span>{data.metrics.completedRequiredLessons}/{data.metrics.requiredLessons} aulas obrigatórias concluídas</span>
          <span>{data.metrics.failedAttempts} tentativa(s) não aprovada(s)</span>
          {data.metrics.latestScore != null && <span>Último resultado: {data.metrics.latestScore}%</span>}
        </div>
      )}

      {data?.signals.length === 0 && (
        <p className="tutorSignalEmpty">Não há recomendação adicional neste momento. Continue usando o conteúdo publicado conforme sua necessidade de estudo.</p>
      )}

      <div className="tutorSignalList">
        {data?.signals.map((signal, index) => (
          <article key={`${signal.type}-${index}`} data-tone={signal.tone}>
            <strong>{signal.title}</strong>
            <p>{signal.message}</p>
            {signal.recommendedLessonId && <small>Aula recomendada: {signal.recommendedLessonId}</small>}
          </article>
        ))}
      </div>

      {status && <p className="tutorSignalStatus">{status}</p>}

      {data && (
        <footer>
          <span>Fonte: estado acadêmico</span>
          <span>Diagnóstico: não</span>
          <span>Perfil comercial: não</span>
          <span>Persistência de perfil: não</span>
          <span>Provider externo: não</span>
        </footer>
      )}
    </section>
  )
}
