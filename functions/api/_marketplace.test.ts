import { describe, expect, it } from 'vitest'
import { canTransitionMarketplace, commissionRuleIsEffective, validateCommissionRule } from './_marketplace'

describe('marketplace workflow', () => {
  it('allows only explicit review transitions', () => {
    expect(canTransitionMarketplace('submitted', 'under_review')).toBe(true)
    expect(canTransitionMarketplace('under_review', 'approved')).toBe(true)
    expect(canTransitionMarketplace('approved', 'published')).toBe(true)
    expect(canTransitionMarketplace('submitted', 'published')).toBe(false)
    expect(canTransitionMarketplace('published', 'approved')).toBe(false)
  })
})

describe('marketplace commission rules', () => {
  it('requires 10000 basis points for percentage mode', () => {
    expect(validateCommissionRule({
      calculationMode: 'percentage',
      ifarmShareValue: 2000,
      instructorShareValue: 8000,
      partnerShareValue: 0,
      gatewayFeeResponsibility: 'ifarm',
      validFrom: '2026-09-03T00:00:00.000Z',
      rationale: 'Regra comercial aprovada',
      confirmed: true,
    })).toEqual([])

    expect(validateCommissionRule({
      calculationMode: 'percentage',
      ifarmShareValue: 1000,
      instructorShareValue: 8000,
      partnerShareValue: 0,
      gatewayFeeResponsibility: 'ifarm',
      validFrom: '2026-09-03T00:00:00.000Z',
      rationale: 'Inválida',
      confirmed: true,
    })).toContain('shares percentuais devem totalizar 10000 basis points')
  })

  it('never accepts an unconfirmed rule', () => {
    expect(validateCommissionRule({
      calculationMode: 'fixed_amount',
      ifarmShareValue: 1000,
      instructorShareValue: 5000,
      partnerShareValue: 0,
      gatewayFeeResponsibility: 'shared',
      validFrom: '2026-09-03T00:00:00.000Z',
      rationale: 'Ainda não confirmada',
      confirmed: false,
    })).toContain('confirmação humana explícita é obrigatória')
  })

  it('evaluates validity window without assuming defaults', () => {
    expect(commissionRuleIsEffective({ status: 'active', valid_from: '2026-01-01T00:00:00.000Z', valid_until: null }, new Date('2026-09-03T00:00:00.000Z'))).toBe(true)
    expect(commissionRuleIsEffective({ status: 'active', valid_from: '2027-01-01T00:00:00.000Z', valid_until: null }, new Date('2026-09-03T00:00:00.000Z'))).toBe(false)
  })
})
