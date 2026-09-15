PRAGMA foreign_keys = ON;

ALTER TABLE academy_payment_webhook_receipts ADD COLUMN reconcile_state TEXT NOT NULL DEFAULT 'scheduled'
  CHECK(reconcile_state IN ('scheduled','claimed','done','dead_letter'));
ALTER TABLE academy_payment_webhook_receipts ADD COLUMN reconcile_attempts INTEGER NOT NULL DEFAULT 0 CHECK(reconcile_attempts >= 0);
ALTER TABLE academy_payment_webhook_receipts ADD COLUMN reconcile_next_attempt_at TEXT;
ALTER TABLE academy_payment_webhook_receipts ADD COLUMN reconcile_claim_token TEXT;
ALTER TABLE academy_payment_webhook_receipts ADD COLUMN reconcile_claimed_at TEXT;
ALTER TABLE academy_payment_webhook_receipts ADD COLUMN reconcile_last_error TEXT;

UPDATE academy_payment_webhook_receipts
SET reconcile_state=CASE
  WHEN status IN ('processed','ignored','failed') THEN 'done'
  ELSE 'scheduled'
END,
reconcile_next_attempt_at=CASE
  WHEN status IN ('verified_pending_resource_fetch','canonical_verified') THEN received_at
  ELSE NULL
END;

CREATE INDEX IF NOT EXISTS idx_payment_receipts_reconcile
ON academy_payment_webhook_receipts(reconcile_state,reconcile_next_attempt_at,received_at);

CREATE TRIGGER IF NOT EXISTS trg_payment_receipt_reconcile_guard
BEFORE UPDATE ON academy_payment_webhook_receipts
BEGIN
  SELECT CASE WHEN NEW.reconcile_attempts < OLD.reconcile_attempts
    THEN RAISE(ABORT,'reconciliation attempts cannot decrease') END;

  SELECT CASE WHEN NEW.reconcile_state='claimed' AND (
    NEW.reconcile_claim_token IS NULL OR length(trim(NEW.reconcile_claim_token))=0 OR NEW.reconcile_claimed_at IS NULL
  ) THEN RAISE(ABORT,'claimed reconciliation requires token and timestamp') END;

  SELECT CASE WHEN NEW.reconcile_state IN ('scheduled','done','dead_letter') AND (
    NEW.reconcile_claim_token IS NOT NULL OR NEW.reconcile_claimed_at IS NOT NULL
  ) THEN RAISE(ABORT,'non-claimed reconciliation cannot retain claim') END;

  SELECT CASE WHEN NEW.reconcile_state='scheduled' AND NEW.status IN ('processed','ignored','failed')
    THEN RAISE(ABORT,'terminal receipt cannot be scheduled for reconciliation') END;

  SELECT CASE WHEN NEW.reconcile_state='done' AND NEW.status NOT IN ('processed','ignored','failed','canonical_verified')
    THEN RAISE(ABORT,'done reconciliation requires non-retryable receipt state') END;
END;
