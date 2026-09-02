import { useEffect, useState } from 'react'
import {
  changeCoursePublication,
  loadCourseReadiness,
  loadPublicationCourses,
  type CourseReadinessResult,
} from '../services/coursePublicationApi'
import type { CourseSummary } from '../services/courseBuilderApi'

export function CoursePublicationPage() {
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [readiness, setReadiness] = useState<Record<string, CourseReadinessResult>>({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [serverAvailable, setServerAvailable] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const items = await loadPublicationCourses()
      setCourses(items)
      const pairs = await Promise.all(items.map(async (course) => {
        try {
          return [course.id, await loadCourseReadiness(course.id)] as const
        } catch {
          return [course.id, null] as const
        }
      }))
      setReadiness(Object.fromEntries(pairs.filter((pair): pair is readonly [string, CourseReadinessResult] => pair[1] !== null)))
      setServerAvailable(true)
    } catch {
      setServerAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function transition(courseId: string, action: 'submit_review' | 'publish' | 'return_draft' | 'archive') {
    setMessage('Atualizando status do curso...')
    try {
      const result = await changeCoursePublication(courseId, action)
      setMessage(`Curso atualizado: ${result.data.previousStatus} → ${result.data.status}.`)
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o curso.')
    }
  }

  return (
    <div>
      <div className="pageHeader">
        <div>
          <h1>Publicação de cursos</h1>
          <p>Governança de revisão e publicação do catálogo da Academy.</p>
          <small>{loading ? 'Carregando cursos...' : serverAvailable ? 'Workflow conectado ao backend' : 'Backend ainda não disponível neste ambiente'}</small>
          {message && <small style={{ display: 'block', marginTop: 4 }}>{message}</small>}
        </div>
      </div>

      {!serverAvailable && (
        <section className="panel">
          <h2>Workflow aguardando infraestrutura</h2>
          <p>A publicação real exige identity boundary e D1. O Course Builder continua disponível localmente enquanto isso.</p>
        </section>
      )}

      {serverAvailable && !loading && courses.length === 0 && (
        <section className="panel">
          <h2>Nenhum curso persistido</h2>
          <p>Salve um curso pelo Course Builder para iniciar o fluxo de revisão e publicação.</p>
        </section>
      )}

      {serverAvailable && courses.length > 0 && (
        <div className="cards3">
          {courses.map((course) => {
            const state = readiness[course.id]
            const issues = state?.issues ?? []
            return (
              <article className="panel" key={course.id}>
                <small>{course.id}</small>
                <h2>{course.title}</h2>
                <p>{course.moduleCount} módulos · {course.lessonCount} aulas</p>
                <p><strong>Status: {course.status}</strong></p>
                {state && <p>{state.ready ? 'Pronto para publicação.' : 'Ainda existem pendências de publicação.'}</p>}

                {issues.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {issues.map((issue) => <small key={issue} style={{ display: 'block', marginBottom: 4 }}>{issue}</small>)}
                  </div>
                )}

                {course.status === 'draft' && (
                  <button className="primary" onClick={() => void transition(course.id, 'submit_review')}>
                    Enviar para revisão
                  </button>
                )}

                {course.status === 'review' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="primary" disabled={state ? !state.ready : true} onClick={() => void transition(course.id, 'publish')}>
                      Publicar curso
                    </button>
                    <button onClick={() => void transition(course.id, 'return_draft')}>Voltar para rascunho</button>
                  </div>
                )}

                {course.status === 'published' && (
                  <button onClick={() => void transition(course.id, 'archive')}>Arquivar curso</button>
                )}

                {course.status === 'archived' && <small>Curso arquivado.</small>}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
