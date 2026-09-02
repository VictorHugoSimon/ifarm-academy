import { describe, expect, it } from 'vitest'
import { evaluateCertificateEligibility } from './assessmentService'
import { runAssessmentRuleChecks } from './assessmentRuleChecks'

describe('regras acadêmicas críticas', () => {
  it('executa as verificações determinísticas do fluxo de avaliação', () => {
    expect(runAssessmentRuleChecks()).toMatchObject({ passed: true, checks: 6, finalScore: 100 })
  })

  it('bloqueia certificado sem tentativa quando avaliação é obrigatória', () => {
    const result = evaluateCertificateEligibility({
      courseProgressPercent: 100,
      quizRequired: true,
      minimumScore: 70,
    })
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Realize a avaliação obrigatória.')
  })

  it('libera curso sem avaliação quando o progresso está completo', () => {
    const result = evaluateCertificateEligibility({
      courseProgressPercent: 100,
      quizRequired: false,
      minimumScore: 0,
    })
    expect(result.eligible).toBe(true)
  })
})
