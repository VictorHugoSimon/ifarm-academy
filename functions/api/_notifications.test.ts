import { describe, expect, it } from 'vitest'
import { normalizeActionPath } from './_notifications'

describe('notification action paths', () => {
  it('accepts a relative application path', () => {
    expect(normalizeActionPath('/courses/C1')).toBe('/courses/C1')
  })

  it('rejects protocol-relative URLs', () => {
    expect(() => normalizeActionPath('//evil.example')).toThrow()
  })

  it('rejects absolute external URLs', () => {
    expect(() => normalizeActionPath('https://example.com')).toThrow()
  })

  it('returns null for an empty action', () => {
    expect(normalizeActionPath('')).toBeNull()
  })
})
