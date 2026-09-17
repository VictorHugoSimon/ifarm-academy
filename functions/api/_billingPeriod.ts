export type BillingInterval = 'monthly' | 'annual'
export type BillingPeriodStartSource = 'provider_period_start' | 'provider_occurred_at'

export interface DerivedBillingPeriod {
  billingInterval: BillingInterval
  periodStart: string
  periodEnd: string
  startSource: BillingPeriodStartSource
  endSource: 'academy_derived_from_checkout_interval'
  providerReportedPeriodStart: string | null
  providerReportedPeriodEnd: string | null
  providerPeriodEndMatches: boolean | null
}

function validDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value.trim())
  return Number.isNaN(date.getTime()) ? null : date
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

export function addBillingIntervalUtc(startIso: string, interval: BillingInterval): string | null {
  const start = validDate(startIso)
  if (!start) return null

  const year = start.getUTCFullYear()
  const month = start.getUTCMonth()
  const day = start.getUTCDate()
  const hour = start.getUTCHours()
  const minute = start.getUTCMinutes()
  const second = start.getUTCSeconds()
  const millisecond = start.getUTCMilliseconds()

  let targetYear = year
  let targetMonth = month
  if (interval === 'monthly') {
    targetMonth += 1
    if (targetMonth > 11) {
      targetYear += Math.floor(targetMonth / 12)
      targetMonth %= 12
    }
  } else if (interval === 'annual') {
    targetYear += 1
  } else {
    return null
  }

  const targetDay = Math.min(day, daysInUtcMonth(targetYear, targetMonth))
  return new Date(Date.UTC(targetYear, targetMonth, targetDay, hour, minute, second, millisecond)).toISOString()
}

export function deriveVerifiedBillingPeriod(input: {
  billingInterval: unknown
  providerPeriodStart?: string | null
  providerPeriodEnd?: string | null
  providerOccurredAt?: string | null
}): DerivedBillingPeriod | null {
  const interval = input.billingInterval === 'monthly' || input.billingInterval === 'annual'
    ? input.billingInterval
    : null
  if (!interval) return null

  const providerStart = validDate(input.providerPeriodStart ?? null)
  const providerOccurred = validDate(input.providerOccurredAt ?? null)
  const providerEnd = validDate(input.providerPeriodEnd ?? null)
  const start = providerStart ?? providerOccurred
  if (!start) return null

  const periodStart = start.toISOString()
  const periodEnd = addBillingIntervalUtc(periodStart, interval)
  if (!periodEnd || Date.parse(periodEnd) <= Date.parse(periodStart)) return null

  return {
    billingInterval: interval,
    periodStart,
    periodEnd,
    startSource: providerStart ? 'provider_period_start' : 'provider_occurred_at',
    endSource: 'academy_derived_from_checkout_interval',
    providerReportedPeriodStart: providerStart?.toISOString() ?? null,
    providerReportedPeriodEnd: providerEnd?.toISOString() ?? null,
    providerPeriodEndMatches: providerEnd ? providerEnd.getTime() === Date.parse(periodEnd) : null,
  }
}
