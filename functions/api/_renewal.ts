export type RenewalState = 'not_configured' | 'not_due' | 'upcoming' | 'due'

export interface RenewalInfo {
  state: RenewalState
  renewalDueAt: string | null
  daysRemaining: number | null
}

export function normalizeRenewalMonths(value: unknown): number | null | undefined {
  if (value == null || value === '') return null
  const months = Number(value)
  if (!Number.isInteger(months) || months <= 0 || months > 120) return undefined
  return months
}

export function addMonthsClampedIso(value: string, months: number): string | null {
  const source = new Date(value)
  if (Number.isNaN(source.getTime()) || !Number.isInteger(months) || months <= 0) return null

  const sourceYear = source.getUTCFullYear()
  const sourceMonth = source.getUTCMonth()
  const sourceDay = source.getUTCDate()
  const absoluteMonth = sourceMonth + months
  const targetYear = sourceYear + Math.floor(absoluteMonth / 12)
  const targetMonth = ((absoluteMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()

  const result = new Date(Date.UTC(
    targetYear,
    targetMonth,
    Math.min(sourceDay, lastDay),
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ))
  return result.toISOString()
}

export function evaluateRenewal(
  completedAt: string | null | undefined,
  renewalMonths: number | null | undefined,
  nowValue: string | Date = new Date(),
  upcomingWindowDays = 30,
): RenewalInfo {
  if (!completedAt || !renewalMonths) {
    return { state: 'not_configured', renewalDueAt: null, daysRemaining: null }
  }

  const renewalDueAt = addMonthsClampedIso(completedAt, renewalMonths)
  if (!renewalDueAt) return { state: 'not_configured', renewalDueAt: null, daysRemaining: null }

  const now = nowValue instanceof Date ? nowValue : new Date(nowValue)
  if (Number.isNaN(now.getTime())) return { state: 'not_configured', renewalDueAt, daysRemaining: null }

  const due = new Date(renewalDueAt)
  const milliseconds = due.getTime() - now.getTime()
  const daysRemaining = Math.ceil(milliseconds / 86_400_000)
  if (milliseconds <= 0) return { state: 'due', renewalDueAt, daysRemaining }
  if (daysRemaining <= upcomingWindowDays) return { state: 'upcoming', renewalDueAt, daysRemaining }
  return { state: 'not_due', renewalDueAt, daysRemaining }
}
