export interface MediaPlayback {
  courseId: string
  lessonId: string
  mediaType: 'video' | 'audio'
  provider: string
  providerRef?: string | null
  playbackUrl: string
}

export async function loadMediaPlayback(courseId: string, lessonId: string): Promise<MediaPlayback> {
  const response = await fetch(
    `/api/media?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`,
    { headers: { accept: 'application/json' } },
  )
  if (!response.ok) throw new Error(`Academy API ${response.status}: ${await response.text()}`)
  const result = await response.json() as { data: MediaPlayback }
  return result.data
}
