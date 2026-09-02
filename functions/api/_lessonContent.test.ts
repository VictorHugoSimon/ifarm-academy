import { describe, expect, it } from 'vitest'
import { lessonContentPublicationIssue, normalizeLessonContent } from './_lessonContent'

describe('lesson content contract', () => {
  it('aceita somente URLs http/https', () => {
    expect(normalizeLessonContent({ externalUrl: 'https://example.com/material.pdf' }).ok).toBe(true)
    expect(normalizeLessonContent({ externalUrl: 'javascript:alert(1)' })).toEqual({
      ok: false,
      error: 'externalUrl deve usar http ou https',
    })
  })

  it('remove campos não reconhecidos', () => {
    expect(normalizeLessonContent({ body: ' Aula ', secret: 'não persistir' })).toEqual({
      ok: true,
      content: { body: 'Aula' },
    })
  })

  it('identifica conteúdo mínimo para publicação', () => {
    expect(lessonContentPublicationIssue('text', {})).toBe('conteúdo textual vazio')
    expect(lessonContentPublicationIssue('text', { body: 'Conteúdo' })).toBeNull()
    expect(lessonContentPublicationIssue('video', {})).toContain('mídia')
    expect(lessonContentPublicationIssue('video', { providerRef: 'video-123' })).toBeNull()
    expect(lessonContentPublicationIssue('quiz', {})).toContain('quiz vinculado')
  })
})
