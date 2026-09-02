import { useMemo, useState } from 'react'
import { calculateProgress, loadStudentProgress, saveStudentProgress } from '../services/studentProgressRepository'
import { loadQuiz } from '../services/quizRepository'
import type { QuizAttempt } from '../domain/assessment'
import { QuizAttemptPanel } from './QuizAttemptPanel'
import '../styles/quiz-player.css'
import '../styles/assessment-cert.css'

const lessons = [
  { id: 'L001', title: 'Introdução à segurança rural', duration: '08:00', type: 'video' },
  { id: 'L002', title: 'Identificação de riscos no campo', duration: '09:00', type: 'video' },
  { id: 'L003', title: 'Máquinas, equipamentos e prevenção', duration: '12:00', type: 'video' },
  { id: 'L004', title: 'Procedimentos e evidências', duration: '07:00', type: 'text' },
  { id: 'L005', title: 'Avaliação final', duration: '15 min', type: 'quiz' },
]

export function StudentAssessmentPlayerPage() {
  const [progress, setProgress] = useState(() => loadStudentProgress())
  const [lastAttempt, setLastAttempt] = useState<QuizAttempt | null>(null)
  const quiz = useMemo(() => loadQuiz(), [])
  const activeLesson = lessons.find((lesson) => lesson.id === progress.activeLessonId) ?? lessons[0]
  const courseProgress = useMemo(() => calculateProgress(progress), [progress])

  function persist(next: typeof progress) {
    setProgress(saveStudentProgress(next))
  }

  function selectLesson(lessonId: string) {
    persist({ ...progress, activeLessonId: lessonId })
  }

  function markLessonComplete(lessonId: string, moveNext = true) {
    const nextLessons = progress.lessons.map((lesson) =>
      lesson.lessonId === lessonId
        ? { ...lesson, completed: true, progressPercent: 100 }
        : lesson,
    )
    const currentIndex = lessons.findIndex((lesson) => lesson.id === lessonId)
    const nextActive = moveNext
      ? lessons[Math.min(currentIndex + 1, lessons.length - 1)].id
      : progress.activeLessonId
    persist({ ...progress, lessons: nextLessons, activeLessonId: nextActive })
  }

  function onQuizFinished(attempt: QuizAttempt) {
    setLastAttempt(attempt)
    if (attempt.status === 'approved') markLessonComplete('L005', false)
  }

  return (
    <div className="studentPlayerPage">
      <div className="playerTopbar">
        <div><small>NR-31</small><h1>Segurança no Trabalho na Agricultura</h1></div>
        <div className="playerProgress"><span>{courseProgress}% concluído</span><div><i style={{ width: `${courseProgress}%` }} /></div></div>
      </div>

      <div className="playerLayout">
        <main className="lessonStage">
          <div className={`mediaStage ${activeLesson.type === 'quiz' ? 'quizStage' : ''}`}>
            {activeLesson.type === 'video' && (
              <div className="videoPlaceholder">
                <strong>{activeLesson.title}</strong>
                <span>Player preparado para integração com o provedor de streaming.</span>
              </div>
            )}
            {activeLesson.type === 'text' && (
              <article className="textLesson">
                <h2>{activeLesson.title}</h2>
                <p>Conteúdo textual com suporte futuro a anexos, links, evidências e materiais complementares.</p>
                <p>Treinamentos regulatórios podem exigir presença, prática e validação conforme a configuração do treinamento.</p>
              </article>
            )}
            {activeLesson.type === 'quiz' && <QuizAttemptPanel quiz={quiz} onFinished={onQuizFinished} />}
          </div>

          <section className="lessonInfo">
            <div>
              <span className="lessonType">{activeLesson.type.toUpperCase()}</span>
              <h2>{activeLesson.title}</h2>
              <p>Duração estimada: {activeLesson.duration}</p>
              {activeLesson.type === 'quiz' && lastAttempt?.status === 'manual_review' && (
                <p className="reviewPendingText">Avaliação enviada. A resposta aberta aguarda revisão do responsável.</p>
              )}
            </div>
            {activeLesson.type !== 'quiz' && (
              <button className="primary" onClick={() => markLessonComplete(activeLesson.id)}>Marcar como concluída</button>
            )}
          </section>
        </main>

        <aside className="lessonSidebar">
          <div className="lessonSidebarHead"><strong>Conteúdo do curso</strong><small>5 aulas</small></div>
          {lessons.map((lesson, index) => {
            const state = progress.lessons.find((item) => item.lessonId === lesson.id)
            return (
              <button key={lesson.id} className={`lessonNavItem ${lesson.id === activeLesson.id ? 'active' : ''}`} onClick={() => selectLesson(lesson.id)}>
                <span className={`lessonState ${state?.completed ? 'done' : ''}`}>{state?.completed ? '✓' : index + 1}</span>
                <div><strong>{lesson.title}</strong><small>{lesson.duration} · {lesson.type}</small></div>
              </button>
            )
          })}
        </aside>
      </div>
    </div>
  )
}
