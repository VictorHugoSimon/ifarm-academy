import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { loadMyEnrollments, type EnrollmentRecord } from '../services/enrollmentApi'
import { askTutor, loadTutorHistory, loadTutorSessions, type TutorMessage, type TutorSessionSummary } from '../services/tutorApi'
import '../styles/tutor.css'

export function TutorPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([])
  const [courseId, setCourseId] = useState('')
  const [sessions, setSessions] = useState<TutorSessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(true)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableCourses = useMemo(
    () => enrollments.filter((item) => item.status === 'active' || item.status === 'completed'),
    [enrollments],
  )

  useEffect(() => {
    void loadMyEnrollments()
      .then((rows) => {
        setEnrollments(rows)
        const first = rows.find((item) => item.status === 'active' || item.status === 'completed')
        if (first) setCourseId(first.courseId)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar suas matrículas.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!courseId) return
    setError(null)
    setMessages([])
    setSessionId(null)
    void loadTutorSessions(courseId)
      .then(async (rows) => {
        setSessions(rows)
        const latest = rows.find((item) => item.status === 'active')
        if (latest) {
          setSessionId(latest.id)
          const history = await loadTutorHistory(latest.id)
          setMessages(history.messages)
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o histórico do Tutor IA.'))
  }, [courseId])

  async function selectSession(nextSessionId: string) {
    setSessionId(nextSessionId)
    setError(null)
    try {
      const history = await loadTutorHistory(nextSessionId)
      setMessages(history.messages)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir esta conversa.')
    }
  }

  function newConversation() {
    setSessionId(null)
    setMessages([])
    setQuestion('')
    setError(null)
  }

  async function submitQuestion(event: FormEvent) {
    event.preventDefault()
    const cleanQuestion = question.trim()
    if (!courseId || cleanQuestion.length < 3) return
    setAsking(true)
    setError(null)
    try {
      const answer = await askTutor({ courseId, question: cleanQuestion, sessionId })
      setSessionId(answer.sessionId)
      setQuestion('')
      const history = await loadTutorHistory(answer.sessionId)
      setMessages(history.messages)
      setSessions(await loadTutorSessions(courseId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o Tutor IA.')
    } finally {
      setAsking(false)
    }
  }

  if (loading) return <div className="tutorState">Carregando Tutor IA…</div>

  if (!availableCourses.length) {
    return (
      <section className="tutorPage">
        <div className="tutorHero">
          <div><small>TUTOR IA</small><h2>Conteúdo autorizado, sem respostas inventadas</h2></div>
          <span className="tutorModeBadge">Modo evidência</span>
        </div>
        <div className="tutorEmpty">Você precisa de uma matrícula ativa ou concluída para usar o Tutor IA.</div>
      </section>
    )
  }

  return (
    <section className="tutorPage">
      <div className="tutorHero">
        <div>
          <small>TUTOR IA</small>
          <h2>Dúvidas ancoradas no conteúdo do curso</h2>
          <p>Esta versão não usa um LLM externo. Ela localiza somente trechos autorizados das suas aulas e sempre mostra a fonte.</p>
        </div>
        <span className="tutorModeBadge">Modo evidência</span>
      </div>

      <div className="tutorControls">
        <label>
          Curso
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            {availableCourses.map((item) => <option key={item.courseId} value={item.courseId}>{item.courseTitle}</option>)}
          </select>
        </label>
        <button type="button" className="secondary" onClick={newConversation}>Nova conversa</button>
      </div>

      {sessions.length > 0 && (
        <div className="tutorSessions" aria-label="Conversas anteriores">
          {sessions.slice(0, 8).map((item, index) => (
            <button key={item.id} className={sessionId === item.id ? 'active' : ''} onClick={() => void selectSession(item.id)}>
              Conversa {sessions.length - index}
              <span>{new Date(item.lastMessageAt).toLocaleString('pt-BR')}</span>
            </button>
          ))}
        </div>
      )}

      <div className="tutorConversation">
        {!messages.length && (
          <div className="tutorEmpty">
            Faça uma pergunta sobre o curso selecionado. Se o assunto não existir no conteúdo autorizado, o Tutor informará que não possui evidência suficiente.
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className={`tutorMessage ${message.role}`}>
            <header>{message.role === 'user' ? 'Você' : 'Tutor IA'}</header>
            <p>{message.content}</p>
            {message.role === 'assistant' && message.citations.length > 0 && (
              <div className="tutorCitations">
                <strong>Fontes do curso</strong>
                {message.citations.map((citation) => (
                  <div className="tutorCitation" key={`${message.id}-${citation.lessonId}`}>
                    <span>{citation.moduleTitle} → {citation.lessonTitle}</span>
                    <blockquote>{citation.excerpt}</blockquote>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      <form className="tutorComposer" onSubmit={submitQuestion}>
        <label>
          Sua pergunta
          <textarea
            value={question}
            maxLength={1000}
            rows={4}
            placeholder="Ex.: Como a umidade do solo influencia a decisão de irrigação?"
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>
        <div className="tutorComposerFooter">
          <span>{question.length}/1000</span>
          <button type="submit" disabled={asking || question.trim().length < 3}>{asking ? 'Buscando evidências…' : 'Consultar conteúdo'}</button>
        </div>
      </form>

      {error && <div className="academyInlineError">{error}</div>}
    </section>
  )
}
