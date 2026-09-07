import { describe, expect, it } from 'vitest'
import { normalizePublicTextList, publicSlug, safePublicAssetRef } from './_publicDiscovery'

describe('public discovery validation', () => {
  it('accepts canonical slugs and rejects raw text', () => {
    expect(publicSlug('agricultura-digital-2026')).toBe('agricultura-digital-2026')
    expect(publicSlug('Agricultura Digital 2026')).toBeNull()
    expect(publicSlug('---')).toBeNull()
  })

  it('accepts only safe public asset refs', () => {
    expect(safePublicAssetRef('/assets/instructor.jpg')).toBe('/assets/instructor.jpg')
    expect(safePublicAssetRef('https://cdn.example.com/photo.jpg')).toBe('https://cdn.example.com/photo.jpg')
    expect(safePublicAssetRef('//evil.example/photo.jpg')).toBeNull()
    expect(safePublicAssetRef('javascript:alert(1)')).toBeNull()
    expect(safePublicAssetRef('http://example.com/photo.jpg')).toBeNull()
  })

  it('deduplicates and bounds public specialties', () => {
    expect(normalizePublicTextList(['IoT Rural', ' iot rural ', 'Irrigação'])).toEqual(['IoT Rural','Irrigação'])
    expect(normalizePublicTextList(Array.from({ length: 20 }, (_, index) => `Tema ${index}`))).toHaveLength(12)
  })
})
