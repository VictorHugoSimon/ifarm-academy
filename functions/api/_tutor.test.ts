import { describe, expect, it } from 'vitest'
import { buildTutorChunks, evidenceOnlyMessage, scoreTutorEvidence, tutorQueryTokens } from './_tutor'

describe('Tutor grounded retrieval', () => {
  it('indexa somente texto autorizado da aula', () => {
    const chunks = buildTutorChunks({
      body: 'A irrigação localizada aplica água próxima à zona radicular.',
      instructions: 'Compare vazão e pressão antes da atividade prática.',
      externalUrl: 'https://example.com/private',
      providerRef: 'secret-video-ref',
    })
    expect(chunks).toHaveLength(2)
    expect(chunks.map((item) => item.sourceType)).toEqual(['lesson_body', 'lesson_instructions'])
    expect(chunks.some((item) => item.text.includes('secret-video-ref'))).toBe(false)
  })

  it('normaliza tokens e ignora stopwords', () => {
    expect(tutorQueryTokens('Como funciona a pressão na irrigação?')).toEqual(['funciona', 'pressao', 'irrigacao'])
  })

  it('prioriza evidência relevante sem gerar resposta técnica', () => {
    const ranked = scoreTutorEvidence('pressão irrigação', [
      { id: '1', courseId: 'c1', lessonId: 'l1', sourceTitle: 'Irrigação', sourceType: 'lesson_body', text: 'Pressão e vazão precisam ser verificadas.' },
      { id: '2', courseId: 'c1', lessonId: 'l2', sourceTitle: 'Clima', sourceType: 'lesson_body', text: 'A temperatura do ar varia durante o dia.' },
    ])
    expect(ranked).toHaveLength(1)
    expect(ranked[0].id).toBe('1')
    expect(evidenceOnlyMessage(ranked).mode).toBe('evidence_only')
  })

  it('falha seguro quando não há contexto autorizado', () => {
    const result = evidenceOnlyMessage([])
    expect(result.mode).toBe('insufficient_context')
    expect(result.text).toContain('Não encontrei conteúdo autorizado suficiente')
  })
})
