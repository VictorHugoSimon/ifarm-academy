import { describe, expect, it } from 'vitest'
import {
  paymentClaimCutoff,
  paymentReconciliationConfig,
  paymentRetryAt,
  paymentRetryDelaySeconds,
  requirePaymentWorker,
  shouldDeadLetter,
} from './_paymentReconciliation'

describe('payment reconciliation policy', () => {
  it('uses bounded worker configuration', () => {
    expect(paymentReconciliationConfig({})).toEqual({ maxAttempts: 8, claimTtlSeconds: 300, batchSize: 10 })
    expect(paymentReconciliationConfig({
      ACADEMY_PAYMENT_RECONCILE_MAX_ATTEMPTS: '4',
      ACADEMY_PAYMENT_RECONCILE_CLAIM_TTL_SECONDS: '90',
      ACADEMY_PAYMENT_RECONCILE_BATCH_SIZE: '20',
    })).toEqual({ maxAttempts: 4, claimTtlSeconds: 90, batchSize: 20 })
    expect(paymentReconciliationConfig({
      ACADEMY_PAYMENT_RECONCILE_MAX_ATTEMPTS: '100',
      ACADEMY_PAYMENT_RECONCILE_CLAIM_TTL_SECONDS: '1',
      ACADEMY_PAYMENT_RECONCILE_BATCH_SIZE: '0',
    })).toEqual({ maxAttempts: 8, claimTtlSeconds: 300, batchSize: 10 })
  })

  it('fails closed when worker secret is absent or invalid', async () => {
    const notConfigured = requirePaymentWorker({}, new Request('https://academy.test/api/payments/mercado-pago/reconcile'))
    expect(notConfigured).toBeInstanceOf(Response)
    expect((notConfigured as Response).status).toBe(503)

    const unauthorized = requirePaymentWorker(
      { ACADEMY_PAYMENT_WORKER_SECRET: 'correct-secret' },
      new Request('https://academy.test/api/payments/mercado-pago/reconcile', {
        headers: { 'x-academy-payment-worker-secret': 'wrong', 'x-academy-worker-id': 'cron-1' },
      }),
    )
    expect(unauthorized).toBeInstanceOf(Response)
    expect((unauthorized as Response).status).toBe(401)

    expect(requirePaymentWorker(
      { ACADEMY_PAYMENT_WORKER_SECRET: 'correct-secret' },
      new Request('https://academy.test/api/payments/mercado-pago/reconcile', {
        headers: { 'x-academy-payment-worker-secret': 'correct-secret', 'x-academy-worker-id': 'cron-1' },
      }),
    )).toEqual({ workerId: 'cron-1' })
  })

  it('uses exponential retry capped at one hour', () => {
    expect(paymentRetryDelaySeconds(1)).toBe(30)
    expect(paymentRetryDelaySeconds(2)).toBe(60)
    expect(paymentRetryDelaySeconds(3)).toBe(120)
    expect(paymentRetryDelaySeconds(20)).toBe(3600)
    expect(paymentRetryAt(new Date('2026-09-15T12:00:00.000Z'), 2)).toBe('2026-09-15T12:01:00.000Z')
  })

  it('computes stale claim cutoff and dead letter condition deterministically', () => {
    expect(paymentClaimCutoff(new Date('2026-09-15T12:10:00.000Z'), 300)).toBe('2026-09-15T12:05:00.000Z')
    expect(shouldDeadLetter(7, 8)).toBe(false)
    expect(shouldDeadLetter(8, 8)).toBe(true)
  })
})
