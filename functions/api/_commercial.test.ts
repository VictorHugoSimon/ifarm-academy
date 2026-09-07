import { describe, expect, it } from 'vitest'
import { SMART_FARM_CONSENT, commercialConsentSnapshot, commercialToken, isCommercialOfferSystem, isCommercialSourceType, isCommercialStage, normalizePipelineUpdate } from './_commercial'

describe('commercial engine validation', () => {
  it('accepts only known source, target and pipeline enums', () => {
    expect(isCommercialSourceType('course_completion')).toBe(true)
    expect(isCommercialSourceType('behavior_score')).toBe(false)
    expect(isCommercialOfferSystem('ifarm_store')).toBe(true)
    expect(isCommercialOfferSystem('unknown_crm')).toBe(false)
    expect(isCommercialStage('opportunity')).toBe(true)
    expect(isCommercialStage('reopened')).toBe(false)
  })

  it('validates safe commercial tokens', () => {
    expect(commercialToken('Irrigation')).toBe('irrigation')
    expect(commercialToken('ifarm.store:sensor-kit')).toBe('ifarm.store:sensor-kit')
    expect(commercialToken('interesse com espaço')).toBeNull()
  })

  it('requires complete immutable consent snapshots', () => {
    expect(commercialConsentSnapshot(SMART_FARM_CONSENT)).toEqual({
      purpose: SMART_FARM_CONSENT.purpose,
      text: SMART_FARM_CONSENT.text,
      version: SMART_FARM_CONSENT.version,
    })
    expect(commercialConsentSnapshot({ purpose: '', text: 'ok', version: 'v1' })).toBeNull()
  })

  it('requires conversion reference to mark an opportunity converted', () => {
    expect(normalizePipelineUpdate({ stage: 'converted' })).toBeNull()
    expect(normalizePipelineUpdate({ stage: 'converted', conversionRef: 'CRM-123' })).toEqual({ stage: 'converted', conversionRef: 'CRM-123' })
    expect(normalizePipelineUpdate({ stage: 'qualified' })).toEqual({ stage: 'qualified', conversionRef: null })
  })
})
