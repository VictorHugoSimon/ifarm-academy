import { describe, expect, it } from 'vitest'
import { dayDistance, nextStreak, utcDateKey } from './_gamification'

describe('gamification streak rules', () => {
  it('normalizes activity to UTC date', () => {
    expect(utcDateKey('2026-09-06T23:59:59.000Z')).toBe('2026-09-06')
  })

  it('increments a consecutive day and preserves best streak', () => {
    expect(nextStreak(3, 5, '2026-09-05', '2026-09-06')).toEqual({
      currentDays: 4,
      bestDays: 5,
      lastActivityDate: '2026-09-06',
    })
  })

  it('does not double count two events on the same day', () => {
    expect(nextStreak(4, 5, '2026-09-06', '2026-09-06')).toEqual({
      currentDays: 4,
      bestDays: 5,
      lastActivityDate: '2026-09-06',
    })
  })

  it('resets the current streak after a gap but preserves the historical best', () => {
    expect(nextStreak(4, 7, '2026-09-01', '2026-09-04')).toEqual({
      currentDays: 1,
      bestDays: 7,
      lastActivityDate: '2026-09-04',
    })
  })

  it('calculates day distance in UTC', () => {
    expect(dayDistance('2026-02-28', '2026-03-01')).toBe(1)
  })
})
