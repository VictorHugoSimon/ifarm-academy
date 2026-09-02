import { describe, expect, it } from 'vitest'
import { numberValue, nullableNumber, percent, resolveReportWindow } from './_reporting'

describe('reporting helpers', () => {
  it('defaults to a 30-day UTC window', () => {
    const result = resolveReportWindow(
      new Request('https://academy.test/api/reports'),
      new Date('2026-09-02T18:00:00.000Z'),
    )
    expect(result).not.toBeInstanceOf(Response)
    if (result instanceof Response) return
    expect(result.from).toBe('2026-08-04T00:00:00.000Z')
    expect(result.to).toBe('2026-09-02T23:59:59.999Z')
  })

  it('accepts explicit date-only boundaries inclusively', () => {
    const result = resolveReportWindow(new Request('https://academy.test/api/reports?from=2026-08-01&to=2026-08-31'))
    expect(result).not.toBeInstanceOf(Response)
    if (result instanceof Response) return
    expect(result.from).toBe('2026-08-01T00:00:00.000Z')
    expect(result.to).toBe('2026-08-31T23:59:59.999Z')
  })

  it('rejects reversed and oversized windows', async () => {
    const reversed = resolveReportWindow(new Request('https://academy.test/api/reports?from=2026-09-02&to=2026-09-01'))
    expect(reversed).toBeInstanceOf(Response)
    const oversized = resolveReportWindow(new Request('https://academy.test/api/reports?from=2025-01-01&to=2026-09-01'))
    expect(oversized).toBeInstanceOf(Response)
  })

  it('normalizes percentages and numbers safely', () => {
    expect(percent(3, 4)).toBe(75)
    expect(percent(1, 3)).toBe(33.33)
    expect(percent(1, 0)).toBe(0)
    expect(numberValue('12')).toBe(12)
    expect(numberValue('invalid')).toBe(0)
    expect(nullableNumber(null)).toBeNull()
    expect(nullableNumber('91.5')).toBe(91.5)
  })
})
