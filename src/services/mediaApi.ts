import { authenticatedJson } from './authenticatedFetch'

export interface MediaPlayback {
  courseId: string
  lessonId: string
  mediaType: 'video' | 'audio'
  provider: string
  providerRef?: string | null
  playbackUrl: string
}

export async function loadMediaPlayback(courseId: string, lessonId: string): Promise<MediaPlayback> {
  const result = await authenticatedJson<{ data: MediaPlayback }>(
    `/api/media?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`,
    { headers: { accept: 'application/json' } },
  )
  return result.data
}
