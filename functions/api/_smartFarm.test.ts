import { describe, expect, it } from 'vitest'
import { hashEventToken, isInterestCode, tokenIsUsable, validateTokenWindow } from './_smartFarm'

describe('Smart Farm Experience rules', () => {
  it('accepts only supported commercial interest codes', () => {
    expect(isInterestCode('irrigation')).toBe(true)
    expect(isInterestCode('credit')).toBe(true)
    expect(isInterestCode('anything')).toBe(false)
  })

  it('hashes tokens deterministically without persisting plaintext', async () => {
    const first = await hashEventToken('TOKEN-123')
    const second = await hashEventToken('TOKEN-123')
    expect(first).toBe(second)
    expect(first).not.toContain('TOKEN-123')
    expect(first).toHaveLength(64)
  })

  it('limits token windows to the event plus 24h tolerance', () => {
    const eventStart = '2026-09-10T12:00:00.000Z'
    const eventEnd = '2026-09-10T18:00:00.000Z'
    expect(validateTokenWindow(eventStart, eventEnd, '2026-09-10T10:00:00.000Z', '2026-09-10T20:00:00.000Z')).toBeNull()
    expect(validateTokenWindow(eventStart, eventEnd, '2026-09-08T10:00:00.000Z', '2026-09-10T20:00:00.000Z')).toContain('24 horas')
  })

  it('checks activation, time and maximum uses', () => {
    const now = new Date('2026-09-10T15:00:00.000Z')
    expect(tokenIsUsable({ active: 1, valid_from: '2026-09-10T12:00:00.000Z', valid_until: '2026-09-10T18:00:00.000Z' }, now)).toBe(true)
    expect(tokenIsUsable({ active: 0, valid_from: '2026-09-10T12:00:00.000Z', valid_until: '2026-09-10T18:00:00.000Z' }, now)).toBe(false)
    expect(tokenIsUsable({ active: 1, valid_from: '2026-09-10T12:00:00.000Z', valid_until: '2026-09-10T18:00:00.000Z', use_count: 2, max_uses: 2 }, now)).toBe(false)
  })
})
