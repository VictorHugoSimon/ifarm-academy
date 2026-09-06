import { describe, expect, it } from 'vitest'
import { publicCourseSlug, requestHostname } from './_publicTenant'

describe('public tenant boundary helpers', () => {
  it('normalizes a request hostname', () => {
    expect(requestHostname(new Request('https://Academy.Example.com/catalog'))).toBe('academy.example.com')
  })

  it('does not accept tenant identifiers through the public URL', () => {
    expect(requestHostname(new Request('https://academy.example.com/catalog?tenantId=T2'))).toBe('academy.example.com')
  })

  it('accepts localhost only as an explicit development host shape', () => {
    expect(requestHostname(new Request('http://localhost:5173/'))).toBe('localhost')
  })

  it('validates clean public course slugs', () => {
    expect(publicCourseSlug('agricultura-digital')).toBe('agricultura-digital')
    expect(publicCourseSlug('../admin')).toBeNull()
    expect(publicCourseSlug('Curso Com Espaço')).toBeNull()
  })
})
