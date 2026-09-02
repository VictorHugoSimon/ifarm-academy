import { describe, expect, it } from 'vitest'
import { resolveAutomaticStatus, scoreAssessment } from './_assessment'

describe('server assessment scoring', () => {
  it('aprova avaliação automática acima da nota mínima', () => {
    const result = scoreAssessment([
      { id: 'q1', type: 'multiple_choice', points: 6, correctOptionIds: ['a'] },
      { id: 'q2', type: 'true_false', points: 4, correctOptionIds: ['true'] },
    ], [
      { questionId: 'q1', optionIds: ['a'] },
      { questionId: 'q2', optionIds: ['true'] },
    ])
    expect(result.percentage).toBe(100)
    expect(resolveAutomaticStatus(result, 70)).toBe('approved')
  })

  it('reprova automaticamente abaixo da nota mínima', () => {
    const result = scoreAssessment([
      { id: 'q1', type: 'multiple_choice', points: 5, correctOptionIds: ['a'] },
      { id: 'q2', type: 'multiple_choice', points: 5, correctOptionIds: ['b'] },
    ], [{ questionId: 'q1', optionIds: ['a'] }])
    expect(result.percentage).toBe(50)
    expect(resolveAutomaticStatus(result, 70)).toBe('failed')
  })

  it('encaminha resposta aberta para revisão manual', () => {
    const result = scoreAssessment([
      { id: 'q1', type: 'multiple_choice', points: 5, correctOptionIds: ['a'] },
      { id: 'q2', type: 'open_answer', points: 5, manualReview: true },
    ], [
      { questionId: 'q1', optionIds: ['a'] },
      { questionId: 'q2', answerText: 'Resposta técnica' },
    ])
    expect(result.needsManualReview).toBe(true)
    expect(result.pendingManualQuestionIds).toEqual(['q2'])
    expect(result.percentage).toBeNull()
    expect(resolveAutomaticStatus(result, 70)).toBe('manual_review')
  })

  it('exige combinação exata em múltiplas alternativas corretas', () => {
    const result = scoreAssessment([
      { id: 'q1', type: 'multiple_choice', points: 10, correctOptionIds: ['a', 'c'] },
    ], [{ questionId: 'q1', optionIds: ['a'] }])
    expect(result.automaticPoints).toBe(0)
    expect(result.percentage).toBe(0)
  })
})
