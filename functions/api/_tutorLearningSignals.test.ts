import { describe, expect, it } from 'vitest'
import { buildTutorLearningSignals } from './_tutorLearningSignals'

const lessons = [
  { id: 'L1', title: 'Introdução', required: true, position: 1, progressPercent: 100, completedAt: '2026-09-01T10:00:00Z' },
  { id: 'L2', title: 'Pressão e vazão', required: true, position: 2, progressPercent: 40, completedAt: null },
  { id: 'L3', title: 'Material complementar', required: false, position: 3, progressPercent: 0, completedAt: null },
]

describe('Tutor Learning Signals', () => {
  it('recomenda retomar aula obrigatória usando apenas estado acadêmico objetivo', () => {
    const result = buildTutorLearningSignals({
      cycleStatus: 'active',
      lessons,
      assessmentRequired: true,
      minimumScore: 70,
      attempts: [],
    })
    const signal = result.signals.find((item) => item.type === 'continue_required_lessons')
    expect(signal?.recommendedLessonId).toBe('L2')
    expect(signal?.message).toContain('40%')
    expect(result.metrics.incompleteRequiredLessons).toBe(1)
  })

  it('sinaliza avaliação pronta somente quando aulas obrigatórias estão concluídas', () => {
    const result = buildTutorLearningSignals({
      cycleStatus: 'active',
      lessons: lessons.map((lesson) => lesson.required ? { ...lesson, progressPercent: 100, completedAt: 'done' } : lesson),
      assessmentRequired: true,
      minimumScore: 70,
      attempts: [],
    })
    expect(result.signals.map((item) => item.type)).toContain('assessment_ready')
  })

  it('não diagnostica aluno após tentativa reprovada e expõe apenas fatos verificáveis', () => {
    const result = buildTutorLearningSignals({
      cycleStatus: 'active',
      lessons,
      assessmentRequired: true,
      minimumScore: 70,
      attempts: [
        { id: 'A1', attemptNumber: 1, status: 'failed', finalPercentage: 55 },
        { id: 'A2', attemptNumber: 2, status: 'failed', finalPercentage: 62 },
      ],
    })
    const signal = result.signals.find((item) => item.type === 'assessment_review_recommended')
    expect(signal?.facts.failedAttempts).toBe(2)
    expect(signal?.facts.latestScore).toBe(62)
    expect(signal?.message).not.toMatch(/fraco|incapaz|déficit|transtorno|diagnóstico/i)
  })

  it('orienta aguardar correção manual sem recomendar nova tentativa', () => {
    const result = buildTutorLearningSignals({
      cycleStatus: 'active',
      lessons,
      assessmentRequired: true,
      attempts: [{ id: 'A1', attemptNumber: 1, status: 'manual_review', finalPercentage: null }],
    })
    const signal = result.signals.find((item) => item.type === 'manual_review_pending')
    expect(signal?.message).toContain('Não é necessário refazer')
  })

  it('em ciclo concluído retorna sinal de revisão, sem reabrir progresso', () => {
    const result = buildTutorLearningSignals({
      cycleStatus: 'completed',
      lessons: lessons.map((lesson) => lesson.required ? { ...lesson, progressPercent: 100, completedAt: 'done' } : lesson),
      assessmentRequired: true,
      attempts: [{ id: 'A1', attemptNumber: 1, status: 'approved', finalPercentage: 90 }],
    })
    expect(result.signals[0]?.type).toBe('course_completed')
    expect(result.signals.some((item) => item.type === 'assessment_ready')).toBe(false)
  })

  it('não produz score de capacidade, risco ou perfil comercial', () => {
    const result = buildTutorLearningSignals({
      cycleStatus: 'active',
      lessons,
      assessmentRequired: false,
      attempts: [],
    })
    const serialized = JSON.stringify(result).toLowerCase()
    expect(serialized).not.toContain('abilityscore')
    expect(serialized).not.toContain('commercial')
    expect(serialized).not.toContain('diagnosis')
  })
})
