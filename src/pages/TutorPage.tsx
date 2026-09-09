import { useEffect, useMemo, useState } from 'react'
import { useAcademySession } from '../session/AcademySessionContext'
import { listCourses } from '../services/courseBuilderApi'
import { loadMyEnrollments } from '../services/enrollmentApi'
import { askTutor, loadTutorSessions, rebuildTutorSources, type TutorAnswer, type TutorSessionSummary } from '../services/tutorApi'
import '../styles/tutor.css'

type CourseOption = { id: string; title: string; source: 'enrollment' | 'admin' }

export function TutorPage() {
  const { academyAdmin } = useAcademySession()
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [courseId, setCourseId] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<TutorAnswer | null>(null)
  const [sessions, setSessions] = useState<TutorSessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void Promise.all([
      loadMyEnrollments().catch(() => []),
      academyAdmin ? listCourses().catch(() => []) : Promise.resolve([]),
      loadTutorSessions().catch(() => []),
    ]).then(([enrollments, adminCourses, history]) => {
      const map = new Map<string, CourseOption>()
      for (const enrollment of enrollments) {
        if (enrollment.status === 'active' || enrollment.status === 'completed') {
          map.set(enrollment.courseId, { id: enrollment.courseId, title: enrollment.courseTitle, source: 'enrollment' })
        }
      }
      for (const course of adminCourses) {
        if (course.status === 'published' && !map.has(course.id)) {
          map.set(course.id, { id: course.id, title: course.title, source: 'admin' })
        }
      }
      const options = [...map.values()]
      setCourses(options)
      setCourseId((current) => current || options[0]?.id || '')
      setSessions(history)
    })
  }, [academyAdmin])

  const selected = useMemo(() => courses.find((course) => course.id === courseId), [courses, courseId])

  async function submitQuestion(event: React.FormEvent) {
    event.preventDefault()
    const text = question.trim()
    if (!courseId || text.length < 3) return
    setBusy(true)
    setStatus('Consultando somente conteúdo autorizado do curso...')
    try {
      const result = await askTutor({ courseId, question: text, sessionId })
      setAnswer(result)
      setSessionId(result.sessionId)
      setQuestion('')
      setStatus(result.mode === 'evidence_only'
        ? 'Resposta limitada às evidências publicadas abaixo.'
        : 'O Tutor não encontrou contexto autorizado suficiente para responder com segurança.')
      setSessions(await loadTutorSessions().catch(() => sessions))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível consultar o Tutor.')
    } finally {
      setBusy(false)
    }
  }

  async function rebuildSources() {
    if (!courseId || !academyAdmin) return
    setBusy(true)
    setStatus('Reconstruindo índice autorizado...')
    try {
      const result = await rebuildTutorSources(courseId)
      setStatus(`${result.chunkCount} trechos autorizados indexados em ${result.lessonCount} aulas.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha ao indexar fontes.')
    } finally {
      setBusy(false)
    }
  }

  function newConversation() {
    setSessionId(undefined)
    setAnswer(null)
    setQuestion('')
    setStatus('Nova conversa iniciada.')
  }

  return (
    <section className="tutorPage">
      <header className="tutorHeader">
        <div>
          <small>iFarm Academy AI Tutor</small>
          <h2>Tutor baseado em conteúdo autorizado</h2>
          <p>O modo atual é <strong>evidence-only</strong>: ele localiza fontes do curso, mas não inventa explicações técnicas além do material publicado.</p>
        </div>
        <button type="button" className="secondaryButton" onClick={newConversation}>Nova conversa</button>
      </header>

      <div className="tutorGrid">
        <aside className="tutorSidebar">
          <label>
            Curso
            <select value={courseId} onChange={(event) => { setCourseId(event.target.value); newConversation() }}>
              {courses.length === 0 && <option value="">Nenhum curso disponível</option>}
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>

          {academyAdmin && (
            <button type="button" className="secondaryButton" disabled={!courseId || busy} onClick={rebuildSources}>
              Atualizar fontes autorizadas
            </button>
          )}

          {selected?.source === 'admin' && (
            <p className="tutorHint">Este curso está disponível para indexação administrativa. Para fazer perguntas como aluno, a identidade atual também precisa estar matriculada.</p>
          )}

          <div className="tutorHistory">
            <h3>Conversas recentes</h3>
            {sessions.length === 0 && <p>Nenhuma conversa registrada.</p>}
            {sessions.slice(0, 8).map((session) => (
              <button key={session.id} type="button" onClick={() => {
                setCourseId(session.course_id)
                setSessionId(session.id)
                setAnswer(null)
                setStatus('Sessão selecionada. Novas perguntas serão adicionadas a ela.')
              }}>
                <strong>{session.title}</strong>
                <small>{new Date(session.updated_at).toLocaleString('pt-BR')}</small>
              </button>
            ))}
          </div>
        </aside>

        <div className="tutorConversation">
          <div className="tutorSafetyNotice">
            <strong>Regra de segurança</strong>
            <span>Sem evidência autorizada suficiente, o Tutor deve dizer que não encontrou base para responder.</span>
          </div>

          {answer && (
            <article className="tutorAnswer">
              <small>{answer.mode === 'evidence_only' ? 'Evidências encontradas' : 'Contexto insuficiente'}</small>
              <p>{answer.answer}</p>
              <div className="tutorCitations">
                {answer.citations.map((citation) => (
                  <blockquote key={citation.chunkId}>
                    <strong>{citation.lessonTitle}</strong>
                    <p>{citation.excerpt}</p>
                    <small>{citation.sourceType === 'lesson_body' ? 'Conteúdo da aula' : 'Instruções da aula'}</small>
                  </blockquote>
                ))}
              </div>
            </article>
          )}

          <form className="tutorComposer" onSubmit={submitQuestion}>
            <label htmlFor="tutor-question">Pergunte sobre o conteúdo do curso</label>
            <textarea
              id="tutor-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={2000}
              placeholder="Ex.: quais cuidados o material apresenta sobre pressão e vazão na irrigação?"
            />
            <div className="tutorComposerFooter">
              <span>{status}</span>
              <button type="submit" disabled={!courseId || question.trim().length < 3 || busy}>{busy ? 'Consultando...' : 'Consultar conteúdo'}</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
