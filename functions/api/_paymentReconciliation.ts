import { json, type Env } from './_shared'

export interface PaymentReconciliationConfig {
  maxAttempts: number
  claimTtlSeconds: number
  batchSize: number
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return diff === 0
}

function boundedInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

export function paymentReconciliationConfig(env: Env): PaymentReconciliationConfig {
  return {
    maxAttempts: boundedInt(env.ACADEMY_PAYMENT_RECONCILE_MAX_ATTEMPTS, 8, 1, 20),
    claimTtlSeconds: boundedInt(env.ACADEMY_PAYMENT_RECONCILE_CLAIM_TTL_SECONDS, 300, 30, 3600),
    batchSize: boundedInt(env.ACADEMY_PAYMENT_RECONCILE_BATCH_SIZE, 10, 1, 50),
  }
}

export function requirePaymentWorker(env: Env, request: Request): { workerId: string } | Response {
  const configured = env.ACADEMY_PAYMENT_WORKER_SECRET?.trim() ?? ''
  if (!configured) return json({ error: 'PAYMENT_RECONCILIATION_WORKER_NOT_CONFIGURED' }, 503)
  const provided = request.headers.get('x-academy-payment-worker-secret')?.trim() ?? ''
  if (!provided || !secureEqual(provided, configured)) return json({ error: 'PAYMENT_RECONCILIATION_WORKER_UNAUTHORIZED' }, 401)
  const workerId = request.headers.get('x-academy-worker-id')?.trim() ?? ''
  if (!workerId || workerId.length > 120) return json({ error: 'PAYMENT_RECONCILIATION_WORKER_ID_REQUIRED' }, 401)
  return { workerId }
}

export function paymentRetryDelaySeconds(attemptNumber: number) {
  const attempt = Math.max(1, Math.floor(attemptNumber || 1))
  return Math.min(30 * (2 ** Math.min(attempt - 1, 7)), 3600)
}

export function paymentRetryAt(from: Date, attemptNumber: number) {
  return new Date(from.getTime() + paymentRetryDelaySeconds(attemptNumber) * 1000).toISOString()
}

export function paymentClaimCutoff(from: Date, ttlSeconds: number) {
  return new Date(from.getTime() - ttlSeconds * 1000).toISOString()
}

export function shouldDeadLetter(attempts: number, maxAttempts: number) {
  return Math.max(0, Math.floor(attempts)) >= Math.max(1, Math.floor(maxAttempts))
}
