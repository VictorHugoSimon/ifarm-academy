import { useEffect, useMemo, useState } from 'react'
import { useAcademySession } from '../session/AcademySessionContext'
import { listCourses } from '../services/courseBuilderApi'
import { loadMyEnrollments } from '../services/enrollmentApi'
import {
  askTutor,
  loadTutorPolicy,
  loadTutorSessions,
  rebuildTutorSources,
  setTutorGenerationPolicy,
  setTutorPolicy,
  type TutorAnswer,
  type TutorPolicyStatus,
  type TutorSessionSummary,
} from '../services/tutorApi'
import '../styles/tutor.css'

type CourseOption = {
  id: string
  title: string
  source: 'enrollment' | 'admin'
  status?: string
}

export function TutorPage() {
  const { academyAdmin } = useAcademySession()
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [courseId, setCourseId] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<TutorAnswer | null>(null)
  const [sessions, setSessions] = useState<TutorSessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [policy, setPolicy] = useState<TutorPolicyStatus | null>(null)
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
          map.set(enrollment.courseId, {
            id: enrollment.courseId,
            title: enrollment.courseTitle,
            source: 'enrollment',
            status: enrollment.courseStatus,
          })
        }
      }
      for (const course of adminCourses) {
        if (!map.has(course.id)) {
          map.set(course.id, { id: course.id, title: course.title, source: 'admin', status: course.status })
        }
      }
      const options = [...map.values()]
      setCourses(options)
      setCourseId((current) => current || options[0]?.id || '')
      setSessions(history)
    })
  }, [academyAdmin])

  useEffect(() => {
    if (!academyAdmin || !courseId) {
      setPolicy(null)
      return
    }
    void loadTutorPolicy(courseId).then(setPolicy).catch(() => setPolicy(null))
  }, [academyAdmin, courseId])

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
      if (result.mode === 'provider_generated') {
        setStatus('Resposta gerada pelo provider autorizado e validada contra as citações do curso.')
      } else if (result.mode === 'evidence_only') {
        setStatus(result.fallbackUsed
          ? 'O provider não passou no contrato de segurança; o Tutor retornou somente evidências.'
          : 'Resposta limitada às evidências publicadas abaixo.')
      } else {
        setStatus('O Tutor não encontrou contexto autorizado suficiente para responder com segurança.')
      }
      setSessions(await loadTutorSessions().catch(() => sessions))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível consultar o Tutor.')
    } finally {
      setBusy(false)
    }
  }

  async function refreshPolicy() {
    if (!academyAdmin || !courseId) return
    setPolicy(await loadTutorPolicy(courseId))
  }

  async function changePolicy(enabled: boolean) {
    if (!courseId || !academyAdmin) return
    setBusy(true)
    setStatus(enabled ? 'Registrando autorização explícita para o Tutor...' : 'Revogando autorização e removendo fontes...')
    try {
      await setTutorPolicy(courseId, enabled)
      await refreshPolicy()
      setAnswer(null)
      setSessionId(undefined)
      setStatus(enabled
        ? selected?.status === 'published'
          ? 'Tutor autorizado e fontes sincronizadas quando disponíveis.'
          : 'Tutor autorizado. A indexação ocorrerá quando o curso for publicado.'
        : 'Tutor desautorizado. O índice e a autorização generativa deste curso foram removidos.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível alterar a autorização do Tutor.')
    } finally {
      setBusy(false)
    }
  }

  async function changeGenerationPolicy(enabled: boolean) {
    if (!courseId || !academyAdmin) return
    setBusy(true)
    setStatus(enabled
      ? 'Registrando autorização separada para geração externa nesta versão publicada...'
      : 'Desativando geração externa para este curso...')
    try {
      await setTutorGenerationPolicy(courseId, enabled)
      await refreshPolicy()
      setAnswer(null)
      setSessionId(undefined)
      setStatus(enabled
        ? 'Geração externa autorizada somente para a versão publicada atual e com citações obrigatórias.'
        : 'Geração externa desativada. O Tutor permanece em evidence-only.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível alterar a autorização generativa.')
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
      await refreshPolicy()
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
          <p>O fallback permanente é <strong>evidence-only</strong>. Geração externa só ocorre quando o curso e a versão publicada possuem uma segunda autorização explícita e o provider server-side está configurado.</p>
        </div>
        <button type="button" className="secondaryButton" onClick={newConversation}>Nova conversa</button>
      </header>

      <div className="tutorGrid">
        <aside className="tutorSidebar">
          <label>
            Curso
            <select value={courseId} onChange={(event) => { setCourseId(event.target.value); newConversation() }}>
              {courses.length === 0 && <option value="">Nenhum curso disponível</option>}
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}{academyAdmin && course.status ? ` · ${course.status}` : ''}</option>
              ))}
            </select>
          </label>

          {academyAdmin && policy && (
            <div className="tutorPolicyCard">
              <strong>{policy.enabled ? 'Tutor autorizado' : 'Tutor não autorizado'}</strong>
              <span>Curso: {policy.courseStatus}</span>
              <span>Fontes indexadas: {policy.chunkCount}</span>
              <span>Última indexação: {policy.lastIndexedAt ? new Date(policy.lastIndexedAt).toLocaleString('pt-BR') : 'ainda não realizada'}</span>
              <span>Provider: {policy.providerRuntime.configured ? `${policy.providerRuntime.mode} configurado` : 'não configurado'}</span>
              <span>Geração externa: {policy.generativeEnabled ? 'autorizada para a versão atual' : 'desativada'}</span>
              {policy.generativeApprovedAt && <span>Aprovação generativa: {new Date(policy.generativeApprovedAt).toLocaleString('pt-BR')}</span>}
              <div className="tutorPolicyActions">
                <button type="button" className="secondaryButton" disabled={busy} onClick={() => void changePolicy(!policy.enabled)}>
                  {policy.enabled ? 'Desautorizar Tutor' : 'Autorizar Tutor'}
                </button>
                <button type="button" className="secondaryButton" disabled={!policy.enabled || policy.courseStatus !== 'published' || busy} onClick={rebuildSources}>
                  Atualizar fontes
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  disabled={busy || !policy.enabled || policy.courseStatus !== 'published' || (!policy.providerRuntime.configured && !policy.generativeEnabled)}
                  onClick={() => void changeGenerationPolicy(!policy.generativeEnabled)}
                >
                  {policy.generativeEnabled ? 'Desativar geração externa' : 'Autorizar geração externa'}
                </button>
              </div>
            </div>
          )}

          {selected?.source === 'admin' && (
            <p className="tutorHint">A autorização administrativa não substitui matrícula. Para fazer perguntas, a identidade atual também precisa estar matriculada no curso.</p>
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
            <span>Publicado não significa autorizado para IA, e autorização do Tutor não significa autorização para provider externo. Sem fonte válida, o Tutor não completa lacunas.</span>
          </div>

          {answer && (
            <article className="tutorAnswer">
              <small>{answer.mode === 'provider_generated'
                ? 'Resposta grounded com citações validadas'
                : answer.mode === 'evidence_only'
                  ? 'Evidências encontradas'
                  : 'Contexto insuficiente'}</small>
              <p>{answer.answer}</p>
              {answer.providerAttempted && answer.providerOutcome !== 'success' && (
                <p className="tutorHint">Fallback de segurança aplicado: {answer.providerOutcome}.</p>
              )}
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
