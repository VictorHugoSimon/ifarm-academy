import { describe, expect, it } from 'vitest'
import { formatWorkload } from './certificateApi'

describe('certificate workload', () => {
  it('formats hours', () => expect(formatWorkload(120)).toBe('2h'))
  it('formats hours and minutes', () => expect(formatWorkload(135)).toBe('2h 15min'))
  it('normalizes negatives', () => expect(formatWorkload(-1)).toBe('0min'))
})
