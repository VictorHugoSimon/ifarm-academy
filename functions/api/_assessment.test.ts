import { describe, expect, it } from 'vitest'
import { resolveAutomaticStatus, resolveManualReview, scoreAssessment } from './_assessment'

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

  it('combina pontuação automática e manual de forma autoritativa', () => {
    const questions = [
      { id: 'q1', type: 'multiple_choice' as const, points: 6, correctOptionIds: ['a'] },
      { id: 'q2', type: 'open_answer' as const, points: 4, manualReview: true },
    ]
    const automatic = scoreAssessment(questions, [
      { questionId: 'q1', optionIds: ['a'] },
      { questionId: 'q2', answerText: 'Resposta parcialmente correta' },
    ])
    const result = resolveManualReview(automatic, questions, [
      { questionId: 'q2', awardedPoints: 2.5, note: 'Atendeu parcialmente aos critérios' },
    ], 70)

    expect(result.manualPoints).toBe(2.5)
    expect(result.manualTotalPoints).toBe(4)
    expect(result.finalPoints).toBe(8.5)
    expect(result.finalPercentage).toBe(85)
    expect(result.status).toBe('approved')
  })

  it('reprova após revisão manual quando nota final fica abaixo da mínima', () => {
    const questions = [
      { id: 'q1', type: 'multiple_choice' as const, points: 5, correctOptionIds: ['a'] },
      { id: 'q2', type: 'open_answer' as const, points: 5, manualReview: true },
    ]
    const automatic = scoreAssessment(questions, [
      { questionId: 'q1', optionIds: ['b'] },
      { questionId: 'q2', answerText: 'Resposta insuficiente' },
    ])
    const result = resolveManualReview(automatic, questions, [
      { questionId: 'q2', awardedPoints: 4 },
    ], 70)

    expect(result.finalPercentage).toBe(40)
    expect(result.status).toBe('failed')
  })

  it('bloqueia revisão incompleta ou pontuação acima do máximo', () => {
    const questions = [
      { id: 'q1', type: 'open_answer' as const, points: 5, manualReview: true },
      { id: 'q2', type: 'open_answer' as const, points: 5, manualReview: true },
    ]
    const automatic = scoreAssessment(questions, [])

    expect(() => resolveManualReview(automatic, questions, [
      { questionId: 'q1', awardedPoints: 5 },
    ], 70)).toThrow('Questão q2 ainda não foi revisada')

    expect(() => resolveManualReview(automatic, questions, [
      { questionId: 'q1', awardedPoints: 6 },
      { questionId: 'q2', awardedPoints: 5 },
    ], 70)).toThrow('Pontuação da questão q1 deve estar entre 0 e 5')
  })
})
