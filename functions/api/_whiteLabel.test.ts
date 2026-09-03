import { describe, expect, it } from 'vitest'
import { DEFAULT_ACADEMY_BRAND, brandFromRow, normalizeHostname, validateBrandInput } from './_whiteLabel'

describe('white-label hostname', () => {
  it('normalizes safe hostnames and rejects URLs', () => {
    expect(normalizeHostname(' Academy.EXAMPLE.com. ')).toBe('academy.example.com')
    expect(normalizeHostname('https://academy.example.com')).toBeNull()
    expect(normalizeHostname('academy.example.com/path')).toBeNull()
    expect(normalizeHostname('localhost')).toBeNull()
  })
})

describe('white-label brand', () => {
  it('keeps iFarm as default when no active row exists', () => {
    expect(brandFromRow(null)).toEqual(DEFAULT_ACADEMY_BRAND)
    expect(brandFromRow({ status: 'inactive' })).toEqual(DEFAULT_ACADEMY_BRAND)
  })

  it('rejects arbitrary colors and unsafe logo protocols', () => {
    const errors = validateBrandInput({
      brandName: 'Parceiro', academyName: 'Academy Parceiro',
      primaryColor: 'green', secondaryColor: '#087A51', accentColor: '#00825B',
      logoRef: 'javascript:alert(1)', catalogMode: 'all_tenant_courses',
    })
    expect(errors).toContain('primaryColor deve usar formato #RRGGBB')
    expect(errors).toContain('logoRef deve usar HTTPS ou referência relativa da Academy')
  })

  it('accepts a constrained brand configuration', () => {
    expect(validateBrandInput({
      brandName: 'Cooperativa X', academyName: 'Cooperativa X Academy',
      primaryColor: '#123456', secondaryColor: '#234567', accentColor: '#345678',
      logoRef: 'https://cdn.example.com/logo.svg', certificateHeading: 'Certificado de conclusão',
      catalogMode: 'selected_courses',
    })).toEqual([])
  })
})
