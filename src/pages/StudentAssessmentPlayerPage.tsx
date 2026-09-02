import { useEffect, useMemo, useState } from 'react'
import { StudentLessonContent } from '../components/StudentLessonContent'
import type { QuizAttempt } from '../domain/assessment'
import { loadMyEnrollments, type EnrollmentRecord } from '../services/enrollmentApi'
import { loadQuiz } from '../services/quizRepository'
import {
  loadStudentCourse,
  saveLessonProgress,
  type StudentCourseDelivery,
  type StudentDeliveredLesson,
} from '../services/studentCourseApi'
import { calculateProgress, loadStudentProgress, saveStudentProgress } from '../services/studentProgressRepository'
import { QuizAttemptPanel } from './QuizAttemptPanel'
import { ServerQuizAttemptPanel } from './ServerQuizAttemptPanel'
import '../styles/quiz-player.css'
import '../styles/assessment-cert.css'

const demoLessons = [
  { id: 'L001', title: 'Introdução à segurança rural', duration: '08:00', type: 'video' },
  { id: 'L002', title: 'Identificação de riscos no campo', duration: '09:00', type: 'video' },
  { id: 'L003', title: 'Máquinas, equipamentos e prevenção', duration: '12:00', type: 'video' },
  { id: 'L004', title: 'Procedimentos e evidências', duration: '07:00', type: 'text' },
  { id: 'L005', title: 'Avaliação final', duration: '15 min', type: 'quiz' },
]

const assessmentLessonId = '__assessment__'

export function StudentAssessmentPlayerPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [delivery, setDelivery] = useState<StudentCourseDelivery | null>(null)
  const [activeLessonId, setActiveLessonId] = useState('')
  const [loadingServer, setLoadingServer] = useState(true)
  const [serverMode, setServerMode] = useState(false)
  const [message, setMessage] = useState('')

  async function loadCourse(courseId: string) {
    const course = await loadStudentCourse(courseId)
    setDelivery(course)
    const allLessons = course.modules.flatMap((module) => module.lessons)
    const firstIncomplete = allLessons.find((lesson) => lesson.progressPercent < 100)
    const firstLesson = allLessons[0]
    setActiveLessonId((current) => {
      const exists = allLessons.some((lesson) => lesson.id === current)
      if (current === assessmentLessonId && course.completion.assessmentRequired) return current
      if (exists) return current
      return firstIncomplete?.id ?? firstLesson?.id ?? (course.completion.assessmentRequired ? assessmentLessonId : '')
    })
    return course
  }

  async function bootstrapServer() {
    setLoadingServer(true)
    try {
      const mine = await loadMyEnrollments()
      const available = mine.filter((item) => item.status === 'active' || item.status === 'completed')
      setEnrollments(available)
      if (!available.length) {
        setServerMode(true)
        setDelivery(null)
        setSelectedCourseId('')
        return
      }
      const courseId = selectedCourseId && available.some((item) => item.courseId === selectedCourseId)
        ? selectedCourseId
        : available[0].courseId
      setSelectedCourseId(courseId)
      await loadCourse(courseId)
      setServerMode(true)
      setMessage('')
    } catch {
      setServerMode(false)
      setDelivery(null)
    } finally {
      setLoadingServer(false)
    }
  }

  useEffect(() => {
    void bootstrapServer()
  }, [])

  async function changeCourse(courseId: string) {
    setSelectedCourseId(courseId)
    setMessage('Carregando curso...')
    try {
      await loadCourse(courseId)
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o curso.')
    }
  }

  async function completeServerLesson(lesson: StudentDeliveredLesson) {
    if (!delivery) return
    setMessage('Salvando progresso...')
    try {
      const result = await saveLessonProgress({
        courseId: delivery.course.id,
        lessonId: lesson.id,
        progressPercent: 100,
        lastPositionSeconds: lesson.durationMinutes * 60,
      })
      const refreshed = await loadCourse(delivery.course.id)
      const allLessons = refreshed.modules.flatMap((module) => module.lessons)
      const currentIndex = allLessons.findIndex((item) => item.id === lesson.id)
      const nextLesson = allLessons[currentIndex + 1]
      if (nextLesson) setActiveLessonId(nextLesson.id)
      else if (refreshed.completion.assessmentRequired && refreshed.completion.quizId) setActiveLessonId(assessmentLessonId)
      if (result.data.enrollmentCompletion?.completed) {
        setMessage('Curso concluído. A certificação foi processada pelo backend.')
      } else {
        setMessage('Progresso salvo.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o progresso.')
    }
  }

  async function handleMediaCompleted(lesson: StudentDeliveredLesson) {
    if (!delivery) return
    try {
      const refreshed = await loadCourse(delivery.course.id)
      const allLessons = refreshed.modules.flatMap((module) => module.lessons)
      const currentIndex = allLessons.findIndex((item) => item.id === lesson.id)
      const nextLesson = allLessons[currentIndex + 1]
      if (nextLesson) setActiveLessonId(nextLesson.id)
      else if (refreshed.completion.assessmentRequired && refreshed.completion.quizId) setActiveLessonId(assessmentLessonId)

      if (refreshed.enrollment.status === 'completed') {
        setMessage('Curso concluído. A certificação foi processada pelo backend.')
      } else {
        setMessage('Mídia concluída e progresso registrado.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Mídia concluída, mas não foi possível atualizar o curso.')
    }
  }

  if (loadingServer) {
    return <section className="panel"><h2>Experiência do aluno</h2><p>Verificando matrículas e progresso...</p></section>
  }

  if (!serverMode) return <LocalDemoStudentPlayer />

  if (!delivery) {
    return (
      <section className="panel">
        <h2>Experiência do aluno</h2>
        <p>Não há matrícula ativa para este usuário. Publique um curso e faça a matrícula pela aba Catálogo e matrículas.</p>
      </section>
    )
  }

  const lessons = delivery.modules.flatMap((module) => module.lessons)
  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId)
  const assessmentActive = activeLessonId === assessmentLessonId
  const assessmentAvailable = delivery.completion.assessmentRequired && Boolean(delivery.completion.quizId)
  const activeLessonIsAssessment = activeLesson
    ? activeLesson.contentType === 'quiz' || activeLesson.contentType === 'exam'
    : false
  const activeLessonIsMedia = activeLesson
    ? activeLesson.contentType === 'video' || activeLesson.contentType === 'audio'
    : false

  return (
    <div className="studentPlayerPage">
      <div className="playerTopbar">
        <div>
          <small>{delivery.course.id}</small>
          <h1>{delivery.course.title}</h1>
          {enrollments.length > 1 && (
            <select value={selectedCourseId} onChange={(event) => void changeCourse(event.target.value)}>
              {enrollments.map((item) => <option key={item.courseId} value={item.courseId}>{item.courseTitle}</option>)}
            </select>
          )}
        </div>
        <div className="playerProgress">
          <span>{delivery.completion.overallProgressPercent}% das aulas obrigatórias</span>
          <div><i style={{ width: `${delivery.completion.overallProgressPercent}%` }} /></div>
          <small>Matrícula: {delivery.enrollment.status}</small>
        </div>
      </div>

      {message && <div className="reviewCard" style={{ marginBottom: 12 }}><p>{message}</p></div>}

      <div className="playerLayout">
        <main className="lessonStage">
          <div className={`mediaStage ${assessmentActive || activeLessonIsAssessment ? 'quizStage' : ''}`}>
            {assessmentActive && delivery.completion.quizId && (
              <ServerQuizAttemptPanel
                quizId={delivery.completion.quizId}
                onFinished={async () => {
                  const refreshed = await loadCourse(delivery.course.id)
                  if (refreshed.enrollment.status === 'completed') {
                    setMessage('Curso concluído. Certificação processada pelo backend.')
                  }
                }}
              />
            )}

            {!assessmentActive && activeLesson && (
              <StudentLessonContent
                courseId={delivery.course.id}
                lesson={activeLesson}
                onMediaCompleted={() => handleMediaCompleted(activeLesson)}
                onAssessmentFinished={async (result) => {
                  if (result.status === 'approved') {
                    await completeServerLesson(activeLesson)
                  } else if (result.status === 'manual_review') {
                    setMessage('Avaliação enviada. Esta aula será concluída após a revisão manual e aprovação.')
                  }
                }}
              />
            )}
          </div>

          {!assessmentActive && activeLesson && (
            <section className="lessonInfo">
              <div>
                <span className="lessonType">{activeLesson.contentType.toUpperCase()}</span>
                <h2>{activeLesson.title}</h2>
                <p>Duração estimada: {activeLesson.durationMinutes} min</p>
                <p>Progresso atual: {activeLesson.progressPercent}%</p>
                {activeLesson.lastPositionSeconds > 0 && activeLesson.progressPercent < 100 && (
                  <p>Retomada registrada em {Math.floor(activeLesson.lastPositionSeconds / 60)} min {activeLesson.lastPositionSeconds % 60}s.</p>
                )}
              </div>
              {!activeLessonIsAssessment && !activeLessonIsMedia && (
                <button
                  className="primary"
                  disabled={activeLesson.progressPercent >= 100 || delivery.enrollment.status === 'completed'}
                  onClick={() => void completeServerLesson(activeLesson)}
                >
                  {activeLesson.progressPercent >= 100 ? 'Aula concluída' : 'Marcar como concluída'}
                </button>
              )}
              {activeLessonIsMedia && activeLesson.progressPercent < 100 && (
                <small>A conclusão desta aula é registrada automaticamente ao terminar a mídia.</small>
              )}
            </section>
          )}
        </main>

        <aside className="lessonSidebar">
          <div className="lessonSidebarHead">
            <strong>Conteúdo do curso</strong>
            <small>{lessons.length} aulas</small>
          </div>
          {delivery.modules.map((module) => (
            <div key={module.id}>
              <div style={{ padding: '10px 12px 4px' }}><small><strong>{module.title}</strong></small></div>
              {module.lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  className={`lessonNavItem ${lesson.id === activeLessonId ? 'active' : ''}`}
                  onClick={() => setActiveLessonId(lesson.id)}
                >
                  <span className={`lessonState ${lesson.progressPercent >= 100 ? 'done' : ''}`}>
                    {lesson.progressPercent >= 100 ? 'OK' : index + 1}
                  </span>
                  <div>
                    <strong>{lesson.title}</strong>
                    <small>{lesson.durationMinutes} min · {lesson.contentType} · {lesson.progressPercent}%</small>
                  </div>
                </button>
              ))}
            </div>
          ))}

          {assessmentAvailable && (
            <button
              className={`lessonNavItem ${assessmentActive ? 'active' : ''}`}
              onClick={() => setActiveLessonId(assessmentLessonId)}
            >
              <span className="lessonState">AV</span>
              <div>
                <strong>Avaliação final</strong>
                <small>Nota mínima {delivery.completion.minimumScore ?? 0}%</small>
              </div>
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}

function LocalDemoStudentPlayer() {
  const [progress, setProgress] = useState(() => loadStudentProgress())
  const [lastAttempt, setLastAttempt] = useState<QuizAttempt | null>(null)
  const quiz = useMemo(() => loadQuiz(), [])
  const activeLesson = demoLessons.find((lesson) => lesson.id === progress.activeLessonId) ?? demoLessons[0]
  const courseProgress = useMemo(() => calculateProgress(progress), [progress])

  function persist(next: typeof progress) {
    setProgress(saveStudentProgress(next))
  }

  function markLessonComplete(lessonId: string, moveNext = true) {
    const nextLessons = progress.lessons.map((lesson) =>
      lesson.lessonId === lessonId ? { ...lesson, completed: true, progressPercent: 100 } : lesson,
    )
    const currentIndex = demoLessons.findIndex((lesson) => lesson.id === lessonId)
    const nextActive = moveNext
      ? demoLessons[Math.min(currentIndex + 1, demoLessons.length - 1)].id
      : progress.activeLessonId
    persist({ ...progress, lessons: nextLessons, activeLessonId: nextActive })
  }

  function onQuizFinished(attempt: QuizAttempt) {
    setLastAttempt(attempt)
    if (attempt.status === 'approved') markLessonComplete('L005', false)
  }

  return (
    <div className="studentPlayerPage">
      <div className="reviewCard" style={{ marginBottom: 12 }}>
        <strong>Modo local de desenvolvimento</strong>
        <p>O identity boundary/D1 não está disponível neste ambiente. O player demonstrativo permanece ativo para validação visual.</p>
      </div>
      <div className="playerTopbar">
        <div><small>NR-31</small><h1>Segurança no Trabalho na Agricultura</h1></div>
        <div className="playerProgress"><span>{courseProgress}% concluído</span><div><i style={{ width: `${courseProgress}%` }} /></div></div>
      </div>

      <div className="playerLayout">
        <main className="lessonStage">
          <div className={`mediaStage ${activeLesson.type === 'quiz' ? 'quizStage' : ''}`}>
            {activeLesson.type === 'video' && <div className="videoPlaceholder"><strong>{activeLesson.title}</strong><span>Player preparado para streaming.</span></div>}
            {activeLesson.type === 'text' && <article className="textLesson"><h2>{activeLesson.title}</h2><p>Conteúdo demonstrativo.</p></article>}
            {activeLesson.type === 'quiz' && <QuizAttemptPanel quiz={quiz} onFinished={onQuizFinished} />}
          </div>
          <section className="lessonInfo">
            <div>
              <span className="lessonType">{activeLesson.type.toUpperCase()}</span>
              <h2>{activeLesson.title}</h2>
              <p>Duração estimada: {activeLesson.duration}</p>
              {activeLesson.type === 'quiz' && lastAttempt?.status === 'manual_review' && <p className="reviewPendingText">Avaliação aguardando revisão.</p>}
            </div>
            {activeLesson.type !== 'quiz' && <button className="primary" onClick={() => markLessonComplete(activeLesson.id)}>Marcar como concluída</button>}
          </section>
        </main>

        <aside className="lessonSidebar">
          <div className="lessonSidebarHead"><strong>Conteúdo do curso</strong><small>5 aulas</small></div>
          {demoLessons.map((lesson, index) => {
            const state = progress.lessons.find((item) => item.lessonId === lesson.id)
            return (
              <button key={lesson.id} className={`lessonNavItem ${lesson.id === activeLesson.id ? 'active' : ''}`} onClick={() => persist({ ...progress, activeLessonId: lesson.id })}>
                <span className={`lessonState ${state?.completed ? 'done' : ''}`}>{state?.completed ? 'OK' : index + 1}</span>
                <div><strong>{lesson.title}</strong><small>{lesson.duration} · {lesson.type}</small></div>
              </button>
            )
          })}
        </aside>
      </div>
    </div>
  )
}
