import { useEffect, useMemo, useState } from 'react'
import { LessonContentEditor } from '../components/LessonContentEditor'
import type { ContentType } from '../domain/academy'
import type { BuilderLesson, CertificateType, CourseBuilderState } from '../domain/builder'
import { loadCourseBuilder, saveCourseBuilder } from '../services/courseBuilderApi'
import { courseBuilderRepository } from '../services/courseBuilderRepository'
import '../styles/course-builder.css'

const contentTypes: Array<[ContentType, string]> = [
  ['video', 'Vídeo'], ['text', 'Texto'], ['pdf', 'PDF'], ['presentation', 'Apresentação'],
  ['audio', 'Áudio'], ['link', 'Link'], ['exercise', 'Exercício'], ['case_study', 'Estudo de caso'],
  ['practical_activity', 'Atividade prática'], ['simulation', 'Simulação'], ['quiz', 'Quiz'], ['exam', 'Prova'],
]

const certificateTypes: Array<[CertificateType, string]> = [
  ['free_course', 'Curso livre'],
  ['corporate_training', 'Treinamento corporativo'],
  ['regulatory_training', 'Treinamento regulamentar'],
  ['partner_certification', 'Certificação de parceiro'],
]

function isContentConfigured(lesson: BuilderLesson): boolean {
  const content = lesson.content ?? {}
  if (lesson.contentType === 'text') return Boolean(content.body?.trim())
  if (lesson.contentType === 'link') return Boolean(content.externalUrl?.trim())
  if (['video', 'audio', 'pdf', 'presentation', 'file'].includes(lesson.contentType)) return Boolean(content.providerRef?.trim() || content.externalUrl?.trim())
  if (['exercise', 'practical_activity', 'case_study', 'simulation'].includes(lesson.contentType)) return Boolean(content.instructions?.trim() || content.body?.trim())
  if (lesson.contentType === 'quiz' || lesson.contentType === 'exam') return Boolean(content.linkedQuizId?.trim())
  return true
}

export function CourseBuilderPage({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<CourseBuilderState>(() => courseBuilderRepository.load())
  const [activeModuleId, setActiveModuleId] = useState(state.modules[0]?.id ?? '')
  const [activeLessonEditorId, setActiveLessonEditorId] = useState('')
  const [persistenceMode, setPersistenceMode] = useState<'checking' | 'server' | 'local'>('checking')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const courseId = state.courseId
    void loadCourseBuilder(courseId)
      .then((remote) => {
        if (cancelled) return
        setState(remote)
        courseBuilderRepository.save(remote)
        setActiveModuleId(remote.modules[0]?.id ?? '')
        setActiveLessonEditorId('')
        setPersistenceMode('server')
      })
      .catch(() => { if (!cancelled) setPersistenceMode('local') })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeModule = useMemo(() => state.modules.find((module) => module.id === activeModuleId) ?? state.modules[0], [state.modules, activeModuleId])
  const activeLessonEditor = useMemo(() => activeModule?.lessons.find((lesson) => lesson.id === activeLessonEditorId), [activeModule, activeLessonEditorId])

  const persist = (next: CourseBuilderState) => {
    setState(next)
    courseBuilderRepository.save(next)
    setSaveMessage('Alterações mantidas como rascunho local até o próximo salvamento.')
  }

  const saveChanges = async () => {
    courseBuilderRepository.save(state)
    setSaveMessage('Salvando...')
    try {
      const saved = await saveCourseBuilder(state)
      setState(saved)
      courseBuilderRepository.save(saved)
      setPersistenceMode('server')
      setSaveMessage('Alterações salvas no backend da Academy.')
    } catch {
      setPersistenceMode('local')
      setSaveMessage('Backend indisponível neste ambiente. Alterações preservadas localmente.')
    }
  }

  const restoreDemo = () => {
    const restored = courseBuilderRepository.reset()
    setState(restored)
    setActiveModuleId(restored.modules[0]?.id ?? '')
    setActiveLessonEditorId('')
    setSaveMessage('Demo restaurada localmente. Use Salvar alterações para sincronizar quando o backend estiver disponível.')
  }

  const selectModule = (moduleId: string) => { setActiveModuleId(moduleId); setActiveLessonEditorId('') }

  const addModule = () => {
    const title = window.prompt('Nome do novo módulo')?.trim()
    if (!title) return
    const id = crypto.randomUUID()
    const next = { ...state, modules: [...state.modules, { id, title, description: '', position: state.modules.length, lessons: [] }] }
    persist(next)
    setActiveModuleId(id)
    setActiveLessonEditorId('')
  }

  const addLesson = () => {
    if (!activeModule) return
    const title = window.prompt('Nome da nova aula')?.trim()
    if (!title) return
    const lesson: BuilderLesson = { id: crypto.randomUUID(), title, contentType: 'video', durationMinutes: 10, required: true, position: activeModule.lessons.length, content: {} }
    persist({ ...state, modules: state.modules.map((module) => module.id === activeModule.id ? { ...module, lessons: [...module.lessons, lesson] } : module) })
    setActiveLessonEditorId(lesson.id)
  }

  const updateLesson = (lessonId: string, patch: Partial<BuilderLesson>) => {
    if (!activeModule) return
    persist({ ...state, modules: state.modules.map((module) => module.id === activeModule.id ? { ...module, lessons: module.lessons.map((lesson) => lesson.id === lessonId ? { ...lesson, ...patch } : lesson) } : module) })
  }

  const moveLesson = (lessonId: string, direction: -1 | 1) => {
    if (!activeModule) return
    const items = [...activeModule.lessons]
    const index = items.findIndex((lesson) => lesson.id === lessonId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    const normalized = items.map((lesson, position) => ({ ...lesson, position }))
    persist({ ...state, modules: state.modules.map((module) => module.id === activeModule.id ? { ...module, lessons: normalized } : module) })
  }

  const totalMinutes = state.modules.flatMap((module) => module.lessons).reduce((sum, lesson) => sum + lesson.durationMinutes, 0)
  const totalLessons = state.modules.reduce((sum, module) => sum + module.lessons.length, 0)
  const pendingRequiredContent = state.modules.flatMap((module) => module.lessons).filter((lesson) => lesson.required && !isContentConfigured(lesson)).length
  const persistenceLabel = persistenceMode === 'server' ? 'Persistência server-side conectada' : persistenceMode === 'checking' ? 'Verificando persistência server-side' : 'Modo local de desenvolvimento'

  return (
    <>
      <div className="pageHeader">
        <div>
          <button className="textButton" onClick={onBack}>Voltar para cursos</button>
          <h1>Course Builder</h1>
          <p>{state.title} · estrutura, conteúdos e critérios de conclusão.</p>
          <small>{persistenceLabel}</small>
          {saveMessage && <small style={{ display: 'block', marginTop: 4 }}>{saveMessage}</small>}
        </div>
        <div className="headerActions">
          <button onClick={restoreDemo}>Restaurar demo</button>
          <button className="primary" onClick={() => void saveChanges()}>Salvar alterações</button>
        </div>
      </div>

      <section className="builderSummary">
        <article><span>Módulos</span><strong>{state.modules.length}</strong></article>
        <article><span>Aulas</span><strong>{totalLessons}</strong></article>
        <article><span>Carga estimada</span><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}min</strong></article>
        <article><span>Conteúdo obrigatório</span><strong>{pendingRequiredContent ? `${pendingRequiredContent} pendente(s)` : 'Configurado'}</strong></article>
      </section>

      <section className="panel quizSettings">
        <div><h2>Metadados de certificação</h2><p>Estes dados são congelados no certificado emitido e não mudam retroativamente.</p></div>
        <label>Instrutor ou responsável <input value={state.instructorLabel ?? ''} onChange={(event) => persist({ ...state, instructorLabel: event.target.value })} placeholder="Nome do instrutor ou responsável" /></label>
        <label>Tipo de certificado
          <select value={state.certificateType ?? 'free_course'} onChange={(event) => persist({ ...state, certificateType: event.target.value as CertificateType })}>
            {certificateTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </section>

      <div className="builderLayout">
        <aside className="builderModules panel">
          <div className="panelTitle"><h2>Estrutura do curso</h2><button onClick={addModule}>Novo módulo</button></div>
          <div className="moduleList">
            {state.modules.map((module, index) => (
              <button key={module.id} className={module.id === activeModule?.id ? 'active' : ''} onClick={() => selectModule(module.id)}>
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
                  <div className={`lessonRow ${activeLessonEditorId === lesson.id ? 'editing' : ''}`} key={lesson.id}>
                    <span className="lessonIndex">{index + 1}</span>
                    <div className="lessonTitleCell">
                      <input value={lesson.title} onChange={(event) => updateLesson(lesson.id, { title: event.target.value })} />
                      <small className={isContentConfigured(lesson) ? 'contentReady' : 'contentPending'}>{isContentConfigured(lesson) ? 'Conteúdo configurado' : 'Conteúdo pendente'}</small>
                    </div>
                    <select value={lesson.contentType} onChange={(event) => updateLesson(lesson.id, { contentType: event.target.value as ContentType })}>{contentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                    <input type="number" min="0" value={lesson.durationMinutes} onChange={(event) => updateLesson(lesson.id, { durationMinutes: Number(event.target.value) || 0 })} />
                    <label className="switchLabel"><input type="checkbox" checked={lesson.required} onChange={(event) => updateLesson(lesson.id, { required: event.target.checked })} /><span>{lesson.required ? 'Sim' : 'Não'}</span></label>
                    <div className="lessonActions">
                      <button onClick={() => setActiveLessonEditorId(lesson.id)}>Editar conteúdo</button>
                      <button onClick={() => moveLesson(lesson.id, -1)} disabled={index === 0}>Subir</button>
                      <button onClick={() => moveLesson(lesson.id, 1)} disabled={index === activeModule.lessons.length - 1}>Descer</button>
                    </div>
                  </div>
                ))}
                {!activeModule.lessons.length && <div className="emptyBuilder">Este módulo ainda não possui aulas.</div>}
              </div>
              {activeLessonEditor && <LessonContentEditor courseId={state.courseId} lesson={activeLessonEditor} onClose={() => setActiveLessonEditorId('')} onChange={(content) => updateLesson(activeLessonEditor.id, { content })} />}
            </>
          ) : <div className="emptyBuilder">Crie um módulo para começar.</div>}
        </section>
      </div>

      <section className="panel quizSettings">
        <div><h2>Avaliação final</h2><p>Configuração estrutural do curso. A política autoritativa da avaliação é publicada separadamente pelo Quiz Builder.</p></div>
        <label><input type="checkbox" checked={state.quiz.enabled} onChange={(event) => persist({ ...state, quiz: { ...state.quiz, enabled: event.target.checked } })} /> Avaliação obrigatória</label>
        <label>Nota mínima <input type="number" min="0" max="100" value={state.quiz.minimumScore} onChange={(event) => persist({ ...state, quiz: { ...state.quiz, minimumScore: Number(event.target.value) || 0 } })} /> %</label>
        <label>Tentativas <input type="number" min="1" value={state.quiz.attemptsAllowed} onChange={(event) => persist({ ...state, quiz: { ...state.quiz, attemptsAllowed: Number(event.target.value) || 1 } })} /></label>
      </section>
    </>
  )
}
