import { useEffect, useRef, useState } from 'react'
import { loadMediaPlayback } from '../services/mediaApi'
import { saveLessonProgress, type StudentDeliveredLesson } from '../services/studentCourseApi'

export function MediaLessonPlayer({
  courseId,
  lesson,
  onProgressSaved,
}: {
  courseId: string
  lesson: StudentDeliveredLesson
  onProgressSaved?: () => void | Promise<void>
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null)
  const lastSavedPositionRef = useRef(lesson.lastPositionSeconds)
  const savingRef = useRef(false)
  const [playbackUrl, setPlaybackUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [visibleProgress, setVisibleProgress] = useState(lesson.progressPercent)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessage('')
    void loadMediaPlayback(courseId, lesson.id)
      .then((descriptor) => {
        if (!cancelled) setPlaybackUrl(descriptor.playbackUrl)
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Mídia indisponível.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [courseId, lesson.id])

  async function persist(position: number, duration: number, completed = false) {
    if (savingRef.current) return
    if (!Number.isFinite(position) || position < 0) return
    const progress = completed
      ? 100
      : duration > 0
        ? Math.min(99, Math.max(lesson.progressPercent, Math.floor((position / duration) * 100)))
        : lesson.progressPercent

    savingRef.current = true
    try {
      await saveLessonProgress({
        courseId,
        lessonId: lesson.id,
        progressPercent: progress,
        lastPositionSeconds: Math.round(position),
      })
      lastSavedPositionRef.current = position
      setVisibleProgress(progress)
      await onProgressSaved?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a posição da mídia.')
    } finally {
      savingRef.current = false
    }
  }

  function handleLoadedMetadata(element: HTMLMediaElement) {
    const duration = Number.isFinite(element.duration) ? element.duration : 0
    const target = Math.max(0, lesson.lastPositionSeconds)
    if (target > 0 && duration > 0) {
      element.currentTime = Math.min(target, Math.max(0, duration - 1))
    }
  }

  function handleTimeUpdate(element: HTMLMediaElement) {
    const duration = Number.isFinite(element.duration) ? element.duration : 0
    const current = element.currentTime
    if (duration > 0) {
      setVisibleProgress(Math.min(99, Math.max(lesson.progressPercent, Math.floor((current / duration) * 100))))
    }
    if (current - lastSavedPositionRef.current >= 20) void persist(current, duration)
  }

  if (loading) {
    return <div className="videoPlaceholder"><strong>{lesson.title}</strong><span>Carregando mídia autorizada...</span></div>
  }

  if (!playbackUrl) {
    return (
      <div className="videoPlaceholder">
        <strong>{lesson.title}</strong>
        <span>{message || 'Fonte de mídia ainda não disponível neste ambiente.'}</span>
      </div>
    )
  }

  const sharedProps = {
    controls: true,
    preload: 'metadata' as const,
    src: playbackUrl,
    onLoadedMetadata: (event: React.SyntheticEvent<HTMLMediaElement>) => handleLoadedMetadata(event.currentTarget),
    onTimeUpdate: (event: React.SyntheticEvent<HTMLMediaElement>) => handleTimeUpdate(event.currentTarget),
    onPause: (event: React.SyntheticEvent<HTMLMediaElement>) => void persist(event.currentTarget.currentTime, event.currentTarget.duration),
    onEnded: (event: React.SyntheticEvent<HTMLMediaElement>) => void persist(event.currentTarget.duration || event.currentTarget.currentTime, event.currentTarget.duration, true),
  }

  return (
    <div className="academyMediaPlayer">
      <div className="academyMediaFrame">
        {lesson.contentType === 'audio'
          ? <audio ref={(node) => { mediaRef.current = node }} {...sharedProps} />
          : <video ref={(node) => { mediaRef.current = node }} playsInline {...sharedProps} />}
      </div>
      <div className="academyMediaMeta">
        <strong>{lesson.title}</strong>
        <span>{visibleProgress}% concluído</span>
      </div>
      {lesson.lastPositionSeconds > 0 && <small>Retomada disponível a partir de {Math.floor(lesson.lastPositionSeconds / 60)} min {lesson.lastPositionSeconds % 60} s.</small>}
      {message && <small>{message}</small>}
    </div>
  )
}
