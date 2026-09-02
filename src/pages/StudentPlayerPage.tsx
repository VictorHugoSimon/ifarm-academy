import { useMemo, useState } from 'react'
import { calculateProgress, loadStudentProgress, saveStudentProgress } from '../services/studentProgressRepository'
import '../styles/quiz-player.css'

const lessons = [
  { id: 'L001', title: 'Introdução à segurança rural', duration: '08:00', type: 'video' },
  { id: 'L002', title: 'Identificação de riscos no campo', duration: '09:00', type: 'video' },
  { id: 'L003', title: 'Máquinas, equipamentos e prevenção', duration: '12:00', type: 'video' },
  { id: 'L004', title: 'Procedimentos e evidências', duration: '07:00', type: 'text' },
  { id: 'L005', title: 'Avaliação final', duration: '15 min', type: 'quiz' },
]

export function StudentPlayerPage() {
  const [progress, setProgress] = useState(() => loadStudentProgress())
  const activeLesson = lessons.find((lesson) => lesson.id === progress.activeLessonId) ?? lessons[0]
  const courseProgress = useMemo(() => calculateProgress(progress), [progress])

  function persist(next: typeof progress) {
    setProgress(saveStudentProgress(next))
  }

  function selectLesson(lessonId: string) {
    persist({ ...progress, activeLessonId: lessonId })
  }

  function markComplete() {
    const nextLessons = progress.lessons.map((lesson) =>
      lesson.lessonId === activeLesson.id
        ? { ...lesson, completed: true, progressPercent: 100 }
        : lesson,
    )
    const currentIndex = lessons.findIndex((lesson) => lesson.id === activeLesson.id)
    const nextActive = lessons[Math.min(currentIndex + 1, lessons.length - 1)].id
    persist({ ...progress, lessons: nextLessons, activeLessonId: nextActive })
  }

  return (
    <div className="studentPlayerPage">
      <div className="playerTopbar">
        <div>
          <small>NR-31</small>
          <h1>Segurança no Trabalho na Agricultura</h1>
        </div>
        <div className="playerProgress"><span>{courseProgress}% concluído</span><div><i style={{ width: `${courseProgress}%` }} /></div></div>
      </div>

      <div className="playerLayout">
        <main className="lessonStage">
          <div className="mediaStage">
            {activeLesson.type === 'video' && (
              <div className="videoPlaceholder">
                <strong>{activeLesson.title}</strong>
                <span>Player de vídeo preparado para integração com o provedor de streaming.</span>
                <button onClick={() => alert('Streaming será conectado posteriormente.')}>Reproduzir demonstração</button>
              </div>
            )}
            {activeLesson.type === 'text' && (
              <article className="textLesson">
                <h2>{activeLesson.title}</h2>
                <p>Esta aula demonstra o espaço de conteúdo textual da Academy. O editor administrativo poderá publicar texto, anexos, links, evidências e materiais complementares.</p>
                <p>Em treinamentos regulatórios, a plataforma poderá exigir etapas adicionais, presença, prática e validação conforme a configuração do treinamento.</p>
              </article>
            )}
            {activeLesson.type === 'quiz' && (
              <div className="quizEntry">
                <small>Avaliação</small>
                <h2>Avaliação final — NR-31</h2>
                <p>Nota mínima configurada: 70%. Tentativas permitidas: 3.</p>
                <button className="primary">Iniciar avaliação</button>
              </div>
            )}
          </div>

          <section className="lessonInfo">
            <div>
              <span className="lessonType">{activeLesson.type.toUpperCase()}</span>
              <h2>{activeLesson.title}</h2>
              <p>Duração estimada: {activeLesson.duration}</p>
            </div>
            {activeLesson.type !== 'quiz' && <button className="primary" onClick={markComplete}>Marcar como concluída</button>}
          </section>

          <section className="lessonTabs">
            <div className="lessonTabButtons"><button className="active">Sobre a aula</button><button>Materiais</button><button>Anotações</button></div>
            <p>Conteúdo demonstrativo para validar o fluxo do aluno. O progresso desta versão é persistido localmente e será migrado para a API/D1 quando o ambiente STAGE estiver provisionado.</p>
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
                {state && !state.completed && state.progressPercent > 0 && <em>{state.progressPercent}%</em>}
              </button>
            )
          })}
        </aside>
      </div>
    </div>
  )
}
