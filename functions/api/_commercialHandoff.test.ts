import { describe,expect,it } from 'vitest'
import { buildCommercialHandoffPayload,isCommercialEvidenceSystem,isCommercialHandoffDestination,normalizeAttributedValue,normalizeCurrency } from './_commercialHandoff'

describe('commercial handoff domain',()=>{
  it('builds a transport payload without user/contact fields',()=>{
    const payload=buildCommercialHandoffPayload({
      id:'OP1',user_id:'USER-SECRET',email:'person@example.com',phone:'5511999999999',source_type:'certificate_issued',source_ref:'C1',
      source_instance_ref:'CERT1',interest_code:'irrigation',offer_system:'ifarm_services',offer_ref:'SERVICE-1',offer_label_snapshot:'Consultoria',
      consent_evidence_type:'explicit_rule_opt_in',consent_version:'v1',consent_recorded_at:'2026-09-07T20:00:00Z',stage:'qualified',
      conversion_ref:null,updated_at:'2026-09-07T20:00:00Z',
    })
    expect(payload).toEqual(expect.objectContaining({opportunityId:'OP1',sourceRef:'C1',consentVersion:'v1'}))
    expect('userId' in payload).toBe(false)
    expect('email' in payload).toBe(false)
    expect('phone' in payload).toBe(false)
  })

  it('validates destinations and evidence systems',()=>{
    expect(isCommercialHandoffDestination('ifarm_core')).toBe(true)
    expect(isCommercialHandoffDestination('unknown')).toBe(false)
    expect(isCommercialEvidenceSystem('payment')).toBe(true)
    expect(isCommercialEvidenceSystem('spreadsheet')).toBe(false)
  })

  it('normalizes attributed value and currency',()=>{
    expect(normalizeAttributedValue(125000)).toBe(125000)
    expect(normalizeAttributedValue(-1)).toBeUndefined()
    expect(normalizeAttributedValue('')).toBeNull()
    expect(normalizeCurrency('brl')).toBe('BRL')
    expect(normalizeCurrency('REAL')).toBeNull()
  })
})
