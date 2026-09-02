import type { StudentDeliveredLesson } from '../services/studentCourseApi'
import { ServerQuizAttemptPanel } from '../pages/ServerQuizAttemptPanel'

function ExternalResource({ url, label }: { url?: string; label: string }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="lessonExternalLink">
      {label}
    </a>
  )
}

export function StudentLessonContent({
  lesson,
  onAssessmentFinished,
}: {
  lesson: StudentDeliveredLesson
  onAssessmentFinished?: () => void | Promise<void>
}) {
  const content = lesson.content ?? {}

  if (lesson.contentType === 'video' || lesson.contentType === 'audio') {
    return (
      <div className="videoPlaceholder">
        <strong>{lesson.title}</strong>
        <span>
          {content.providerRef
            ? `Mídia preparada em ${content.provider || 'provedor da Academy'} · referência ${content.providerRef}`
            : 'Mídia preparada para integração com o provedor configurado da Academy.'}
        </span>
        <ExternalResource url={content.externalUrl} label="Abrir mídia externa autorizada" />
      </div>
    )
  }

  if (lesson.contentType === 'text') {
    return (
      <article className="textLesson">
        <h2>{lesson.title}</h2>
        <p className="lessonBodyText">{content.body || 'Conteúdo textual ainda não disponível.'}</p>
      </article>
    )
  }

  if (['exercise', 'practical_activity', 'case_study', 'simulation'].includes(lesson.contentType)) {
    return (
      <article className="textLesson">
        <h2>{lesson.title}</h2>
        {content.instructions && (
          <section className="lessonInstructionBlock">
            <strong>Instruções</strong>
            <p className="lessonBodyText">{content.instructions}</p>
          </section>
        )}
        {content.body && <p className="lessonBodyText">{content.body}</p>}
      </article>
    )
  }

  if (lesson.contentType === 'link') {
    return (
      <article className="textLesson">
        <h2>{lesson.title}</h2>
        <p>Este conteúdo utiliza um recurso externo autorizado pelo responsável pelo curso.</p>
        <ExternalResource url={content.externalUrl} label={content.label || 'Abrir recurso externo'} />
      </article>
    )
  }

  if (['pdf', 'presentation', 'file'].includes(lesson.contentType)) {
    return (
      <article className="textLesson">
        <h2>{lesson.title}</h2>
        <p>{content.fileName || 'Material da aula'}</p>
        {content.providerRef && (
          <p className="lessonResourceMeta">
            Material armazenado na Academy · {content.provider || 'storage'} · referência {content.providerRef}
          </p>
        )}
        <ExternalResource url={content.externalUrl} label="Abrir material autorizado" />
      </article>
    )
  }

  if ((lesson.contentType === 'quiz' || lesson.contentType === 'exam') && content.linkedQuizId) {
    return (
      <ServerQuizAttemptPanel
        quizId={content.linkedQuizId}
        onFinished={onAssessmentFinished}
      />
    )
  }

  return (
    <article className="textLesson">
      <h2>{lesson.title}</h2>
      <p>Conteúdo desta aula ainda não está disponível para consumo.</p>
    </article>
  )
}
