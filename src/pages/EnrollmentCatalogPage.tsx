import { useEffect, useMemo, useState } from 'react'
import {
  cancelEnrollment,
  enroll,
  loadCatalog,
  loadMyEnrollments,
  type CatalogCourse,
  type EnrollmentRecord,
} from '../services/enrollmentApi'

export function EnrollmentCatalogPage() {
  const [courses, setCourses] = useState<CatalogCourse[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [serverAvailable, setServerAvailable] = useState(true)

  const enrollmentByCourse = useMemo(
    () => new Map(enrollments.map((item) => [item.courseId, item])),
    [enrollments],
  )

  async function refresh() {
    setLoading(true)
    try {
      const [catalog, mine] = await Promise.all([loadCatalog(), loadMyEnrollments()])
      setCourses(catalog)
      setEnrollments(mine)
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

  async function handleEnroll(courseId: string) {
    setMessage('Processando matrícula...')
    try {
      const result = await enroll(courseId)
      setMessage(result.idempotent ? 'Matrícula já estava ativa.' : result.reactivated ? 'Matrícula reativada.' : 'Matrícula realizada com sucesso.')
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível realizar a matrícula.')
    }
  }

  async function handleCancel(courseId: string) {
    if (!window.confirm('Cancelar sua matrícula neste curso?')) return
    setMessage('Cancelando matrícula...')
    try {
      await cancelEnrollment(courseId)
      setMessage('Matrícula cancelada.')
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível cancelar a matrícula.')
    }
  }

  return (
    <div>
      <div className="pageHeader">
        <div>
          <h1>Catálogo e matrículas</h1>
          <p>Cursos publicados disponíveis para o tenant autenticado.</p>
          <small>{loading ? 'Carregando catálogo...' : serverAvailable ? 'Catálogo conectado ao backend' : 'Backend ainda não disponível neste ambiente'}</small>
          {message && <small style={{ display: 'block', marginTop: 4 }}>{message}</small>}
        </div>
      </div>

      {!serverAvailable && (
        <section className="panel">
          <h2>Catálogo aguardando infraestrutura</h2>
          <p>Quando o STAGE estiver com identity boundary e D1 configurados, esta área carregará apenas os cursos publicados do tenant autenticado e permitirá matrícula real.</p>
        </section>
      )}

      {serverAvailable && !loading && courses.length === 0 && (
        <section className="panel">
          <h2>Nenhum curso publicado</h2>
          <p>Os cursos aparecem aqui depois do fluxo de revisão e publicação.</p>
        </section>
      )}

      {serverAvailable && courses.length > 0 && (
        <div className="cards3">
          {courses.map((course) => {
            const enrollment = enrollmentByCourse.get(course.id)
            const active = enrollment?.status === 'active' || enrollment?.status === 'completed'
            return (
              <article className="panel" key={course.id}>
                <small>{course.id}</small>
                <h2>{course.title}</h2>
                <p>{course.description || 'Curso iFarm Academy.'}</p>
                <p>{course.moduleCount} módulos · {course.lessonCount} aulas</p>
                <p>{course.assessmentRequired ? `Avaliação · nota mínima ${course.minimumScore}%` : 'Sem avaliação obrigatória'}</p>
                {enrollment && <p><strong>Status: {enrollment.status}</strong></p>}
                {active ? (
                  enrollment?.status === 'active'
                    ? <button onClick={() => void handleCancel(course.id)}>Cancelar matrícula</button>
                    : <button disabled>Curso concluído</button>
                ) : (
                  <button className="primary" onClick={() => void handleEnroll(course.id)}>
                    {enrollment?.status === 'cancelled' ? 'Reativar matrícula' : 'Matricular-se'}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
