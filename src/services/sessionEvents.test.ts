import { describe, expect, it } from 'vitest'
import { isSessionExpiredStatus } from './sessionEvents'

describe('Academy session expiry', () => {
  it('trata apenas 401 como sessão expirada', () => {
    expect(isSessionExpiredStatus(401)).toBe(true)
    expect(isSessionExpiredStatus(403)).toBe(false)
    expect(isSessionExpiredStatus(409)).toBe(false)
    expect(isSessionExpiredStatus(503)).toBe(false)
  })
})
