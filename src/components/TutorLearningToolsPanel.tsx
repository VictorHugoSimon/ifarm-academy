import { useMemo, useState } from 'react'
import {
  generateTutorLearningTool,
  type TutorLearningCitation,
  type TutorLearningToolResult,
  type TutorLearningToolType,
} from '../services/tutorLearningToolsApi'
import { TutorLearningSignalsPanel } from './TutorLearningSignalsPanel'
import '../styles/tutor-learning-tools.css'

type Props = {
  courseId: string
  courseTitle?: string
}

const TOOL_LABELS: Record<TutorLearningToolType, string> = {
  summary: 'Resumo',
  flashcards: 'Flashcards',
  practice_exercises: 'Exercícios',
}

function Citation({ citation }: { citation?: TutorLearningCitation }) {
  if (!citation) return null
  return (
    <div className="tutorToolCitation">
      <strong>{citation.lessonTitle}</strong>
      <span>{citation.sourceType === 'lesson_body' ? 'Conteúdo da aula' : 'Instruções da aula'}</span>
      <p>{citation.excerpt}</p>
    </div>
  )
}

export function TutorLearningToolsPanel({ courseId, courseTitle }: Props) {
  const [toolType, setToolType] = useState<TutorLearningToolType>('summary')
  const [focus, setFocus] = useState('')
  const [result, setResult] = useState<TutorLearningToolResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const citations = useMemo(() => {
    const map = new Map<string, TutorLearningCitation>()
    for (const citation of result?.citations ?? []) map.set(citation.sourceId, citation)
    return map
  }, [result])

  async function generate(nextType: TutorLearningToolType = toolType) {
    if (!courseId || busy) return
    setToolType(nextType)
    setBusy(true)
    setResult(null)
    setStatus(`Gerando ${TOOL_LABELS[nextType].toLowerCase()} somente com fontes autorizadas...`)
    try {
      const data = await generateTutorLearningTool({
        courseId,
        toolType: nextType,
        focus: focus.trim() || undefined,
      })
      setResult(data)
      setStatus('Material de estudo criado em modo evidence-only. Nenhuma nota ou progresso foi alterado.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível gerar a ferramenta de estudo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="tutorLearningTools" aria-label="Ferramentas de estudo do Tutor">
        <div className="tutorLearningToolsHeader">
          <div>
            <small>Ferramentas de estudo</small>
            <h3>Estude o conteúdo autorizado de {courseTitle || 'este curso'}</h3>
            <p>Resumos, flashcards e exercícios são materiais de apoio. Não alteram nota, tentativa, progresso, conclusão ou certificado.</p>
          </div>
        </div>

        <label className="tutorToolFocus">
          Foco opcional
          <input
            value={focus}
            onChange={(event) => setFocus(event.target.value)}
            maxLength={300}
            placeholder="Ex.: pressão e vazão, segurança na operação, revisão do módulo..."
          />
        </label>

        <div className="tutorToolActions" role="group" aria-label="Tipo de ferramenta">
          {(Object.keys(TOOL_LABELS) as TutorLearningToolType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={toolType === type ? 'active' : ''}
              disabled={!courseId || busy}
              onClick={() => void generate(type)}
            >
              {busy && toolType === type ? 'Gerando...' : TOOL_LABELS[type]}
            </button>
          ))}
        </div>

        {status && <p className="tutorToolStatus">{status}</p>}

        {result?.artifact.toolType === 'summary' && (
          <article className="tutorToolResult">
            <h4>{result.artifact.title}</h4>
            <ol>
              {result.artifact.bullets.map((item, index) => (
                <li key={`${item.sourceId}-${index}`}>
                  <p>{item.text}</p>
                  <Citation citation={citations.get(item.sourceId)} />
                </li>
              ))}
            </ol>
          </article>
        )}

        {result?.artifact.toolType === 'flashcards' && (
          <div className="tutorFlashcardGrid">
            {result.artifact.cards.map((card, index) => (
              <details key={`${card.sourceId}-${index}`} className="tutorFlashcard">
                <summary>{card.front}</summary>
                <p>{card.back}</p>
                <Citation citation={citations.get(card.sourceId)} />
              </details>
            ))}
          </div>
        )}

        {result?.artifact.toolType === 'practice_exercises' && (
          <article className="tutorToolResult">
            <p className="tutorToolDisclaimer">{result.artifact.disclaimer}</p>
            <div className="tutorExerciseList">
              {result.artifact.items.map((item, index) => (
                <section key={`${item.sourceId}-${index}`}>
                  <strong>{item.prompt}</strong>
                  <details>
                    <summary>Ver referência de estudo</summary>
                    <p>{item.studyReference}</p>
                    <Citation citation={citations.get(item.sourceId)} />
                  </details>
                </section>
              ))}
            </div>
          </article>
        )}

        {result && (
          <footer className="tutorToolMeta">
            <span>Modo: evidence-only</span>
            <span>{result.citations.length} fonte(s) citada(s)</span>
            <span>Avaliação oficial: não</span>
          </footer>
        )}
      </section>

      <TutorLearningSignalsPanel courseId={courseId} courseTitle={courseTitle} />
    </>
  )
}
