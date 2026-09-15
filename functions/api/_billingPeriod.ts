export type BillingInterval = 'monthly' | 'annual'
export type PeriodEvidenceType = 'provider_period' | 'provider_start_plus_checkout_interval' | 'provider_occurrence_plus_checkout_interval'

export interface BillingPeriodEvidence {
  periodStart: string
  periodEnd: string
  evidenceType: PeriodEvidenceType
  evidence: {
    billingInterval: BillingInterval
    startSource: 'provider_period_start' | 'provider_occurrence'
    endSource: 'provider_period_end' | 'checkout_billing_interval'
  }
}

function validIso(value: string | null | undefined): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null
  return new Date(value).toISOString()
}

export function addBillingInterval(start: string, interval: BillingInterval): string | null {
  const source = new Date(start)
  if (Number.isNaN(source.getTime())) return null

  const year = source.getUTCFullYear()
  const month = source.getUTCMonth()
  const day = source.getUTCDate()
  let targetYear = year
  let targetMonth = month

  if (interval === 'monthly') {
    targetMonth += 1
    if (targetMonth > 11) { targetMonth = 0; targetYear += 1 }
  } else if (interval === 'annual') {
    targetYear += 1
  } else {
    return null
  }

  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDay)
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  )).toISOString()
}

export function deriveBillingPeriodEvidence(input: {
  providerPeriodStart?: string | null
  providerPeriodEnd?: string | null
  occurredAt?: string | null
  billingInterval: string
}): BillingPeriodEvidence | null {
  const interval = input.billingInterval === 'monthly' || input.billingInterval === 'annual'
    ? input.billingInterval as BillingInterval
    : null
  if (!interval) return null

  const providerStart = validIso(input.providerPeriodStart)
  const providerEnd = validIso(input.providerPeriodEnd)
  const occurredAt = validIso(input.occurredAt)

  if (providerStart && providerEnd) {
    if (Date.parse(providerEnd) <= Date.parse(providerStart)) return null
    return {
      periodStart: providerStart,
      periodEnd: providerEnd,
      evidenceType: 'provider_period',
      evidence: { billingInterval: interval, startSource: 'provider_period_start', endSource: 'provider_period_end' },
    }
  }

  const start = providerStart ?? occurredAt
  if (!start) return null
  const periodEnd = addBillingInterval(start, interval)
  if (!periodEnd || Date.parse(periodEnd) <= Date.parse(start)) return null

  return {
    periodStart: start,
    periodEnd,
    evidenceType: providerStart ? 'provider_start_plus_checkout_interval' : 'provider_occurrence_plus_checkout_interval',
    evidence: {
      billingInterval: interval,
      startSource: providerStart ? 'provider_period_start' : 'provider_occurrence',
      endSource: 'checkout_billing_interval',
    },
  }
}
