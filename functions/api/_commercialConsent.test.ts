import { describe, expect, it } from 'vitest'
import { resolveCommercialConsentState } from './_commercialConsent'

describe('commercial consent governance',()=>{
  it('keeps contact available when no revocation exists',()=>{
    expect(resolveCommercialConsentState(null,null)).toEqual({globalState:'available',opportunityState:'granted',contactAllowed:true})
  })

  it('blocks contact after global suppression',()=>{
    expect(resolveCommercialConsentState('suppress_all',null)).toEqual({globalState:'suppressed',opportunityState:'granted',contactAllowed:false})
  })

  it('blocks contact after opportunity revocation',()=>{
    expect(resolveCommercialConsentState(null,'revoked')).toEqual({globalState:'available',opportunityState:'revoked',contactAllowed:false})
  })

  it('resume removes only the global block',()=>{
    expect(resolveCommercialConsentState('resume','revoked')).toEqual({globalState:'available',opportunityState:'revoked',contactAllowed:false})
  })

  it('regrant restores opportunity consent only when global contact is available',()=>{
    expect(resolveCommercialConsentState('resume','regranted')).toEqual({globalState:'available',opportunityState:'granted',contactAllowed:true})
    expect(resolveCommercialConsentState('suppress_all','regranted').contactAllowed).toBe(false)
  })
})
