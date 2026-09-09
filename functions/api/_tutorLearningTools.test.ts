import { describe, expect, it } from 'vitest'
import {
  buildTutorLearningArtifact,
  selectTutorLearningEvidence,
  validateTutorLearningArtifact,
} from './_tutorLearningTools'

const candidates = [
  { id: 'S1', courseId: 'C1', lessonId: 'L1', sourceTitle: 'Pressão', sourceType: 'lesson_body' as const, text: 'A pressão deve ser acompanhada junto com a vazão para avaliar o funcionamento do sistema.' },
  { id: 'S2', courseId: 'C1', lessonId: 'L2', sourceTitle: 'Vazão', sourceType: 'lesson_body' as const, text: 'A vazão representa o volume de água fornecido por unidade de tempo no ponto avaliado.' },
  { id: 'S3', courseId: 'C1', lessonId: 'L3', sourceTitle: 'Inspeção', sourceType: 'lesson_instructions' as const, text: 'Registre as leituras e compare os valores observados com os parâmetros definidos no material.' },
]

describe('Tutor grounded learning tools', () => {
  it('seleciona evidências pelo foco sem inventar novas fontes', () => {
    const selected = selectTutorLearningEvidence(candidates, 'vazão de água', 3)
    expect(selected[0]?.id).toBe('S2')
    expect(selected.every((item) => candidates.some((source) => source.id === item.id))).toBe(true)
  })

  it('gera resumo somente com texto e sourceId autorizados', () => {
    const evidence = selectTutorLearningEvidence(candidates)
    const artifact = buildTutorLearningArtifact('summary', evidence, 'Irrigação Inteligente')
    expect(artifact.toolType).toBe('summary')
    expect(validateTutorLearningArtifact(artifact, candidates.map((item) => item.id))).toEqual({ valid: true })
  })

  it('gera flashcards grounded e limitados', () => {
    const evidence = selectTutorLearningEvidence(candidates)
    const artifact = buildTutorLearningArtifact('flashcards', evidence, 'Irrigação')
    expect(artifact.toolType).toBe('flashcards')
    if (artifact.toolType === 'flashcards') {
      expect(artifact.cards.length).toBeGreaterThan(0)
      expect(artifact.cards[0].back).toContain('pressão')
    }
    expect(validateTutorLearningArtifact(artifact, candidates.map((item) => item.id)).valid).toBe(true)
  })

  it('marca exercícios como prática sem efeito acadêmico oficial', () => {
    const artifact = buildTutorLearningArtifact('practice_exercises', selectTutorLearningEvidence(candidates), 'Irrigação')
    expect(artifact.toolType).toBe('practice_exercises')
    if (artifact.toolType === 'practice_exercises') {
      expect(artifact.disclaimer).toContain('Não alteram nota')
      expect(artifact.items[0].studyReference.length).toBeGreaterThan(10)
    }
  })

  it('rejeita artefato com sourceId não autorizado', () => {
    const artifact = buildTutorLearningArtifact('summary', selectTutorLearningEvidence(candidates), 'Irrigação')
    if (artifact.toolType === 'summary') artifact.bullets[0].sourceId = 'FORGED'
    expect(validateTutorLearningArtifact(artifact, candidates.map((item) => item.id))).toEqual({
      valid: false,
      reason: 'source_not_allowed',
    })
  })
})
