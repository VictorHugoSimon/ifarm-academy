import { describe, expect, it } from 'vitest'
import { publicMediaContent, resolveMediaPlayback, safePlaybackUrl } from './_media'

describe('media playback contract', () => {
  it('aceita somente HTTP/HTTPS', () => {
    expect(safePlaybackUrl('https://cdn.example.com/video.mp4')).toContain('https://cdn.example.com/video.mp4')
    expect(safePlaybackUrl('javascript:alert(1)')).toBeNull()
  })

  it('remove URL bruta do conteúdo entregue junto ao curso', () => {
    expect(publicMediaContent({
      provider: 'external',
      providerRef: 'VID-01',
      externalUrl: 'https://cdn.example.com/video.mp4',
    })).toEqual({ provider: 'external', providerRef: 'VID-01', hasPlaybackSource: true })
  })

  it('resolve mídia externa como playback direto', () => {
    expect(resolveMediaPlayback({ externalUrl: 'https://cdn.example.com/audio.mp3' })).toMatchObject({
      mode: 'direct',
      provider: 'external',
      playbackUrl: 'https://cdn.example.com/audio.mp3',
    })
  })

  it('mantém providerRef sem inventar URL de provedor', () => {
    expect(resolveMediaPlayback({ provider: 'academy_stream', providerRef: 'opaque-123' })).toEqual({
      mode: 'provider_pending',
      provider: 'academy_stream',
      providerRef: 'opaque-123',
    })
  })
})
