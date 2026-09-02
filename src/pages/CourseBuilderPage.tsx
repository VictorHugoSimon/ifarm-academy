import { useMemo, useState } from 'react'
import type { ContentType } from '../domain/academy'
import type { BuilderLesson, CourseBuilderState } from '../domain/builder'
import { courseBuilderRepository } from '../services/courseBuilderRepository'

const contentTypes: Array<[ContentType, string]> = [
  ['video', 'Vídeo'], ['text', 'Texto'], ['pdf', 'PDF'], ['presentation', 'Apresentação'],
  ['audio', 'Áudio'], ['link', 'Link'], ['exercise', 'Exercício'], ['case_study', 'Estudo de caso'],
  ['practical_activity', 'Atividade prática'], ['simulation', 'Simulação'], ['quiz', 'Quiz'], ['exam', 'Prova'],
]

export function CourseBuilderPage({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<CourseBuilderState>(() => courseBuilderRepository.load())
  const [activeModuleId, setActiveModuleId] = useState(state.modules[0]?.id ?? '')

  const activeModule = useMemo(
    () => state.modules.find((module) => module.id === activeModuleId) ?? state.modules[0],
    [state.modules, activeModuleId],
  )

  const persist = (next: CourseBuilderState) => {
    setState(next)
    courseBuilderRepository.save(next)
  }

  const addModule = () => {
    const title = window.prompt('Nome do novo módulo')?.trim()
    if (!title) return
    const id = crypto.randomUUID()
    const next = {
      ...state,
      modules: [...state.modules, { id, title, description: '', position: state.modules.length, lessons: [] }],
    }
    persist(next)
    setActiveModuleId(id)
  }

  const addLesson = () => {
    if (!activeModule) return
    const title = window.prompt('Nome da nova aula')?.trim()
    if (!title) return
    const lesson: BuilderLesson = {
      id: crypto.randomUUID(),
      title,
      contentType: 'video',
      durationMinutes: 10,
      required: true,
      position: activeModule.lessons.length,
    }
    persist({
      ...state,
      modules: state.modules.map((module) =>
        module.id === activeModule.id ? { ...module, lessons: [...module.lessons, lesson] } : module,
      ),
    })
  }

  const updateLesson = (lessonId: string, patch: Partial<BuilderLesson>) => {
    if (!activeModule) return
    persist({
      ...state,
      modules: state.modules.map((module) =>
        module.id === activeModule.id
          ? { ...module, lessons: module.lessons.map((lesson) => lesson.id === lessonId ? { ...lesson, ...patch } : lesson) }
          : module,
      ),
    })
  }

  const moveLesson = (lessonId: string, direction: -1 | 1) => {
    if (!activeModule) return
    const items = [...activeModule.lessons]
    const index = items.findIndex((lesson) => lesson.id === lessonId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    const normalized = items.map((lesson, position) => ({ ...lesson, position }))
    persist({
      ...state,
      modules: state.modules.map((module) => module.id === activeModule.id ? { ...module, lessons: normalized } : module),
    })
  }

  const totalMinutes = state.modules.flatMap((module) => module.lessons).reduce((sum, lesson) => sum + lesson.durationMinutes, 0)
  const totalLessons = state.modules.reduce((sum, module) => sum + module.lessons.length, 0)

  return (
    <>
      <div className="pageHeader">
        <div>
          <button className="textButton" onClick={onBack}>Voltar para cursos</button>
          <h1>Course Builder</h1>
          <p>{state.title} · estrutura, conteúdos e critérios de conclusão.</p>
        </div>
        <div className="headerActions">
          <button onClick={() => setState(courseBuilderRepository.reset())}>Restaurar demo</button>
          <button className="primary" onClick={() => courseBuilderRepository.save(state)}>Salvar alterações</button>
        </div>
      </div>

      <section className="builderSummary">
        <article><span>Módulos</span><strong>{state.modules.length}</strong></article>
        <article><span>Aulas</span><strong>{totalLessons}</strong></article>
        <article><span>Carga estimada</span><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}min</strong></article>
        <article><span>Avaliação</span><strong>{state.quiz.enabled ? `Nota mínima ${state.quiz.minimumScore}%` : 'Desativada'}</strong></article>
      </section>

      <div className="builderLayout">
        <aside className="builderModules panel">
          <div className="panelTitle"><h2>Estrutura do curso</h2><button onClick={addModule}>Novo módulo</button></div>
          <div className="moduleList">
            {state.modules.map((module, index) => (
              <button key={module.id} className={module.id === activeModule?.id ? 'active' : ''} onClick={() => setActiveModuleId(module.id)}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><strong>{module.title}</strong><small>{module.lessons.length} aulas</small></div>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel builderWorkspace">
          {activeModule ? (
            <>
              <div className="builderModuleHeader">
                <div><span>Módulo {activeModule.position + 1}</span><h2>{activeModule.title}</h2><p>{activeModule.description || 'Sem descrição.'}</p></div>
                <button className="primary" onClick={addLesson}>Adicionar aula</button>
              </div>

              <div className="lessonTable">
                <div className="lessonHeader"><span>Ordem</span><span>Aula</span><span>Tipo</span><span>Duração</span><span>Obrigatória</span><span>Ações</span></div>
                {activeModule.lessons.map((lesson, index) => (
                  <div className="lessonRow" key={lesson.id}>
                    <span className="lessonIndex">{index + 1}</span>
                    <input value={lesson.title} onChange={(event) => updateLesson(lesson.id, { title: event.target.value })} />
                    <select value={lesson.contentType} onChange={(event) => updateLesson(lesson.id, { contentType: event.target.value as ContentType })}>
                      {contentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <input type="number" min="0" value={lesson.durationMinutes} onChange={(event) => updateLesson(lesson.id, { durationMinutes: Number(event.target.value) || 0 })} />
                    <label className="switchLabel"><input type="checkbox" checked={lesson.required} onChange={(event) => updateLesson(lesson.id, { required: event.target.checked })} /><span>{lesson.required ? 'Sim' : 'Não'}</span></label>
                    <div className="lessonActions"><button onClick={() => moveLesson(lesson.id, -1)} disabled={index === 0}>Subir</button><button onClick={() => moveLesson(lesson.id, 1)} disabled={index === activeModule.lessons.length - 1}>Descer</button></div>
                  </div>
                ))}
                {!activeModule.lessons.length && <div className="emptyBuilder">Este módulo ainda não possui aulas.</div>}
              </div>
            </>
          ) : <div className="emptyBuilder">Crie um módulo para começar.</div>}
        </section>
      </div>

      <section className="panel quizSettings">
        <div><h2>Avaliação final</h2><p>Critérios usados para elegibilidade de conclusão e certificado.</p></div>
        <label><input type="checkbox" checked={state.quiz.enabled} onChange={(event) => persist({ ...state, quiz: { ...state.quiz, enabled: event.target.checked } })} /> Avaliação obrigatória</label>
        <label>Nota mínima <input type="number" min="0" max="100" value={state.quiz.minimumScore} onChange={(event) => persist({ ...state, quiz: { ...state.quiz, minimumScore: Number(event.target.value) || 0 } })} /> %</label>
        <label>Tentativas <input type="number" min="1" value={state.quiz.attemptsAllowed} onChange={(event) => persist({ ...state, quiz: { ...state.quiz, attemptsAllowed: Number(event.target.value) || 1 } })} /></label>
      </section>
    </>
  )
}
