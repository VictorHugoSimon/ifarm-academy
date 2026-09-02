import type { BuilderLesson, LessonContentDraft } from '../domain/builder'

function setField(
  content: LessonContentDraft,
  field: keyof LessonContentDraft,
  value: string,
): LessonContentDraft {
  return { ...content, [field]: value }
}

function contentStatus(lesson: BuilderLesson): string {
  const content = lesson.content ?? {}
  if (lesson.contentType === 'text') return content.body?.trim() ? 'Conteúdo configurado' : 'Conteúdo pendente'
  if (lesson.contentType === 'link') return content.externalUrl?.trim() ? 'Conteúdo configurado' : 'Conteúdo pendente'
  if (['video', 'audio', 'pdf', 'presentation', 'file'].includes(lesson.contentType)) {
    return content.providerRef?.trim() || content.externalUrl?.trim() ? 'Conteúdo configurado' : 'Conteúdo pendente'
  }
  if (['exercise', 'practical_activity', 'case_study', 'simulation'].includes(lesson.contentType)) {
    return content.instructions?.trim() || content.body?.trim() ? 'Conteúdo configurado' : 'Conteúdo pendente'
  }
  if (lesson.contentType === 'quiz' || lesson.contentType === 'exam') {
    return content.linkedQuizId?.trim() ? 'Conteúdo configurado' : 'Conteúdo pendente'
  }
  return 'Conteúdo opcional'
}

export function LessonContentEditor({
  lesson,
  onChange,
  onClose,
}: {
  lesson: BuilderLesson
  onChange: (content: LessonContentDraft) => void
  onClose: () => void
}) {
  const content = lesson.content ?? {}
  const update = (field: keyof LessonContentDraft, value: string) => onChange(setField(content, field, value))

  return (
    <section className="lessonContentEditor">
      <div className="lessonContentEditorHead">
        <div>
          <small>Conteúdo da aula</small>
          <h3>{lesson.title}</h3>
          <p>{contentStatus(lesson)} · tipo {lesson.contentType}</p>
        </div>
        <button onClick={onClose}>Fechar editor</button>
      </div>

      {lesson.contentType === 'text' && (
        <label className="lessonContentField full">
          Conteúdo textual
          <textarea
            rows={10}
            value={content.body ?? ''}
            onChange={(event) => update('body', event.target.value)}
            placeholder="Escreva o conteúdo principal da aula."
          />
        </label>
      )}

      {['exercise', 'practical_activity', 'case_study', 'simulation'].includes(lesson.contentType) && (
        <div className="lessonContentGrid">
          <label className="lessonContentField full">
            Instruções da atividade
            <textarea
              rows={8}
              value={content.instructions ?? ''}
              onChange={(event) => update('instructions', event.target.value)}
              placeholder="Descreva objetivo, etapas, entregáveis e critérios da atividade."
            />
          </label>
          <label className="lessonContentField full">
            Conteúdo de apoio
            <textarea
              rows={5}
              value={content.body ?? ''}
              onChange={(event) => update('body', event.target.value)}
              placeholder="Contexto adicional, estudo de caso ou material complementar."
            />
          </label>
        </div>
      )}

      {lesson.contentType === 'link' && (
        <div className="lessonContentGrid">
          <label className="lessonContentField">
            Nome do recurso
            <input value={content.label ?? ''} onChange={(event) => update('label', event.target.value)} placeholder="Ex.: Referência técnica" />
          </label>
          <label className="lessonContentField">
            URL externa
            <input value={content.externalUrl ?? ''} onChange={(event) => update('externalUrl', event.target.value)} placeholder="https://" />
          </label>
        </div>
      )}

      {['video', 'audio'].includes(lesson.contentType) && (
        <div className="lessonContentGrid">
          <label className="lessonContentField">
            Provedor
            <input value={content.provider ?? ''} onChange={(event) => update('provider', event.target.value)} placeholder="Será definido na integração de mídia" />
          </label>
          <label className="lessonContentField">
            Referência da mídia
            <input value={content.providerRef ?? ''} onChange={(event) => update('providerRef', event.target.value)} placeholder="ID opaco fornecido pelo provedor" />
          </label>
          <label className="lessonContentField full">
            URL externa opcional
            <input value={content.externalUrl ?? ''} onChange={(event) => update('externalUrl', event.target.value)} placeholder="https://" />
          </label>
          <p className="lessonContentNote full">A integração definitiva com streaming ainda não foi provisionada. O campo de referência permite preparar o curso sem armazenar credenciais ou arquivos no banco.</p>
        </div>
      )}

      {['pdf', 'presentation', 'file'].includes(lesson.contentType) && (
        <div className="lessonContentGrid">
          <label className="lessonContentField">
            Nome do arquivo
            <input value={content.fileName ?? ''} onChange={(event) => update('fileName', event.target.value)} placeholder="material.pdf" />
          </label>
          <label className="lessonContentField">
            Referência no storage
            <input value={content.providerRef ?? ''} onChange={(event) => update('providerRef', event.target.value)} placeholder="ID opaco do arquivo" />
          </label>
          <label className="lessonContentField">
            Provedor
            <input value={content.provider ?? ''} onChange={(event) => update('provider', event.target.value)} placeholder="Será definido no provisionamento" />
          </label>
          <label className="lessonContentField">
            URL externa opcional
            <input value={content.externalUrl ?? ''} onChange={(event) => update('externalUrl', event.target.value)} placeholder="https://" />
          </label>
          <p className="lessonContentNote full">O upload real será ligado a um storage exclusivo da iFarm Academy. Até lá, referências e URLs autorizadas podem ser cadastradas sem incluir secrets no frontend.</p>
        </div>
      )}

      {(lesson.contentType === 'quiz' || lesson.contentType === 'exam') && (
        <div className="lessonContentGrid">
          <label className="lessonContentField full">
            Quiz vinculado
            <input value={content.linkedQuizId ?? ''} onChange={(event) => update('linkedQuizId', event.target.value)} placeholder="ID da avaliação publicada" />
          </label>
          <p className="lessonContentNote full">A avaliação precisa estar publicada no mesmo tenant. O gabarito permanece exclusivamente no backend.</p>
        </div>
      )}

      {!['text', 'link', 'video', 'audio', 'pdf', 'presentation', 'file', 'exercise', 'practical_activity', 'case_study', 'simulation', 'quiz', 'exam'].includes(lesson.contentType) && (
        <p className="lessonContentNote">Este tipo de aula não exige conteúdo adicional nesta versão.</p>
      )}
    </section>
  )
}
