import { describe, expect, it } from 'vitest'
import { normalizeExternalBenefits, normalizePlanPrice, planAudience, planCommercialMode, planSlug, validatePlanCommercialShape } from './_plans'

describe('plan validation', () => {
  it('validates public slugs and enums', () => {
    expect(planSlug('plano-pro')).toBe('plano-pro')
    expect(planSlug('Plano Pro')).toBeNull()
    expect(planAudience('corporate')).toBe('corporate')
    expect(planAudience('unknown')).toBeNull()
    expect(planCommercialMode('free')).toBe('free')
    expect(planCommercialMode('other')).toBeNull()
  })

  it('validates explicit price snapshots', () => {
    expect(normalizePlanPrice({ amountCents: 5990, billingInterval: 'monthly', priceUnit: 'subscription' })).toEqual({ amountCents: 5990, billingInterval: 'monthly', priceUnit: 'subscription' })
    expect(normalizePlanPrice({ amountCents: 0, billingInterval: 'monthly', priceUnit: 'subscription' })).toBeNull()
    expect(normalizePlanPrice({ amountCents: 3990, billingInterval: 'monthly', priceUnit: 'per_user' })?.priceUnit).toBe('per_user')
  })

  it('keeps external benefits as references only', () => {
    const benefits = normalizeExternalBenefits([
      { sourceSystem: 'ifarm_store', externalRef: 'SKU-1', label: 'Kit de sensores', description: 'Condição vinculada ao ecossistema.' },
      { sourceSystem: 'ifarm_store', externalRef: 'SKU-1', label: 'Duplicado' },
      { sourceSystem: 'unknown', externalRef: 'X', label: 'Inválido' },
    ])
    expect(benefits).toHaveLength(1)
    expect(benefits[0]).toMatchObject({ sourceSystem: 'ifarm_store', externalRef: 'SKU-1', label: 'Kit de sensores' })
  })

  it('restricts user limits to corporate plans', () => {
    expect(validatePlanCommercialShape({ audienceType: 'individual', commercialMode: 'free', maxUsers: 10 })).toContain('corporativo')
    expect(validatePlanCommercialShape({ audienceType: 'corporate', commercialMode: 'contact_sales', maxUsers: 100 })).toBeNull()
  })
})
