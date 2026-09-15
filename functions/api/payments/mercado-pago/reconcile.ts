import { processMercadoPagoReceipt } from '../../_mercadoPagoReceiptProcessor'
import {
  paymentClaimCutoff,
  paymentReconciliationConfig,
  paymentRetryAt,
  requirePaymentWorker,
  shouldDeadLetter,
} from '../../_paymentReconciliation'
import { dbOr503, json, type Env } from '../../_shared'

interface WorkerOutcome {
  receiptId: string
  state: 'done' | 'scheduled' | 'dead_letter'
  detailCode: string
}

export const onRequestPost = async ({ env, request }: { env: Env; request: Request }) => {
  const worker = requirePaymentWorker(env, request)
  if (worker instanceof Response) return worker

  if (env.ACADEMY_PAYMENT_PROVIDER?.trim().toLowerCase() !== 'mercado_pago' || !env.MERCADOPAGO_ACCESS_TOKEN?.trim()) {
    return json({ error: 'MERCADOPAGO_CANONICAL_FETCH_NOT_CONFIGURED' }, 503)
  }

  const db = dbOr503(env); if (db instanceof Response) return db
  const config = paymentReconciliationConfig(env)
  const now = new Date()
  const nowIso = now.toISOString()
  const staleBefore = paymentClaimCutoff(now, config.claimTtlSeconds)

  // Claims abandoned by a crashed worker become eligible again. Terminal receipts are normalized to done.
  await db.prepare(`UPDATE academy_payment_webhook_receipts
    SET reconcile_state='done',reconcile_claim_token=NULL,reconcile_claimed_at=NULL,reconcile_next_attempt_at=NULL
    WHERE provider='mercado_pago' AND status IN ('processed','ignored','failed')
      AND reconcile_state IN ('scheduled','claimed')`).run()

  await db.prepare(`UPDATE academy_payment_webhook_receipts
    SET reconcile_state='scheduled',reconcile_claim_token=NULL,reconcile_claimed_at=NULL,
      reconcile_next_attempt_at=COALESCE(reconcile_next_attempt_at,?)
    WHERE provider='mercado_pago' AND reconcile_state='claimed'
      AND status IN ('verified_pending_resource_fetch','canonical_verified')
      AND reconcile_claimed_at IS NOT NULL AND datetime(reconcile_claimed_at)<=datetime(?)`)
    .bind(nowIso, staleBefore).run()

  const candidates = await db.prepare(`SELECT id FROM academy_payment_webhook_receipts
    WHERE provider='mercado_pago' AND reconcile_state='scheduled'
      AND status IN ('verified_pending_resource_fetch','canonical_verified')
      AND reconcile_attempts < ?
      AND (reconcile_next_attempt_at IS NULL OR datetime(reconcile_next_attempt_at)<=datetime(?))
    ORDER BY received_at ASC LIMIT ?`)
    .bind(config.maxAttempts, nowIso, config.batchSize).all()

  const outcomes: WorkerOutcome[] = []
  for (const row of (candidates.results ?? []) as Array<{ id: string }>) {
    const receiptId = String(row.id)
    const claimToken = crypto.randomUUID()
    const claimedAt = new Date().toISOString()

    await db.prepare(`UPDATE academy_payment_webhook_receipts SET
      reconcile_state='claimed',reconcile_claim_token=?,reconcile_claimed_at=?,
      reconcile_attempts=reconcile_attempts+1,reconcile_last_error=NULL
      WHERE id=? AND provider='mercado_pago' AND reconcile_state='scheduled'
        AND status IN ('verified_pending_resource_fetch','canonical_verified')
        AND reconcile_attempts < ?
        AND (reconcile_next_attempt_at IS NULL OR datetime(reconcile_next_attempt_at)<=datetime(?))`)
      .bind(claimToken, claimedAt, receiptId, config.maxAttempts, claimedAt).run()

    const claimed = await db.prepare(`SELECT * FROM academy_payment_webhook_receipts
      WHERE id=? AND reconcile_state='claimed' AND reconcile_claim_token=? LIMIT 1`)
      .bind(receiptId, claimToken).first()
    if (!claimed) continue

    try {
      const result = await processMercadoPagoReceipt(env, db, claimed)
      const latest = await db.prepare('SELECT reconcile_attempts,status FROM academy_payment_webhook_receipts WHERE id=? LIMIT 1')
        .bind(receiptId).first()
      const attempts = Number(latest?.reconcile_attempts ?? claimed.reconcile_attempts ?? 1)

      if (result.status === 'processed' || result.status === 'ignored' || result.status === 'failed' || !result.retryable) {
        await db.prepare(`UPDATE academy_payment_webhook_receipts SET
          reconcile_state='done',reconcile_claim_token=NULL,reconcile_claimed_at=NULL,reconcile_next_attempt_at=NULL,
          reconcile_last_error=? WHERE id=? AND reconcile_claim_token=?`)
          .bind(result.status === 'failed' ? result.detailCode : null, receiptId, claimToken).run()
        outcomes.push({ receiptId, state: 'done', detailCode: result.detailCode })
        continue
      }

      if (shouldDeadLetter(attempts, config.maxAttempts)) {
        await db.prepare(`UPDATE academy_payment_webhook_receipts SET
          reconcile_state='dead_letter',reconcile_claim_token=NULL,reconcile_claimed_at=NULL,reconcile_next_attempt_at=NULL,
          reconcile_last_error=? WHERE id=? AND reconcile_claim_token=?`)
          .bind(result.detailCode, receiptId, claimToken).run()
        outcomes.push({ receiptId, state: 'dead_letter', detailCode: result.detailCode })
        continue
      }

      const nextAttemptAt = paymentRetryAt(new Date(), attempts)
      await db.prepare(`UPDATE academy_payment_webhook_receipts SET
        reconcile_state='scheduled',reconcile_claim_token=NULL,reconcile_claimed_at=NULL,reconcile_next_attempt_at=?,
        reconcile_last_error=? WHERE id=? AND reconcile_claim_token=?`)
        .bind(nextAttemptAt, result.detailCode, receiptId, claimToken).run()
      outcomes.push({ receiptId, state: 'scheduled', detailCode: result.detailCode })
    } catch {
      const latest = await db.prepare('SELECT reconcile_attempts FROM academy_payment_webhook_receipts WHERE id=? LIMIT 1')
        .bind(receiptId).first()
      const attempts = Number(latest?.reconcile_attempts ?? claimed.reconcile_attempts ?? 1)
      const detailCode = 'reconciliation_worker_unhandled_failure'
      if (shouldDeadLetter(attempts, config.maxAttempts)) {
        await db.prepare(`UPDATE academy_payment_webhook_receipts SET
          reconcile_state='dead_letter',reconcile_claim_token=NULL,reconcile_claimed_at=NULL,reconcile_next_attempt_at=NULL,
          reconcile_last_error=? WHERE id=? AND reconcile_claim_token=?`).bind(detailCode, receiptId, claimToken).run()
        outcomes.push({ receiptId, state: 'dead_letter', detailCode })
      } else {
        await db.prepare(`UPDATE academy_payment_webhook_receipts SET
          reconcile_state='scheduled',reconcile_claim_token=NULL,reconcile_claimed_at=NULL,reconcile_next_attempt_at=?,
          reconcile_last_error=? WHERE id=? AND reconcile_claim_token=?`)
          .bind(paymentRetryAt(new Date(), attempts), detailCode, receiptId, claimToken).run()
        outcomes.push({ receiptId, state: 'scheduled', detailCode })
      }
    }
  }

  return json({
    data: {
      workerId: worker.workerId,
      selected: (candidates.results ?? []).length,
      claimed: outcomes.length,
      done: outcomes.filter((item) => item.state === 'done').length,
      scheduled: outcomes.filter((item) => item.state === 'scheduled').length,
      deadLetter: outcomes.filter((item) => item.state === 'dead_letter').length,
      outcomes,
    },
  })
}
