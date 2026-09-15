PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_payment_webhook_receipts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('mercado_pago')),
  request_id TEXT NOT NULL,
  notification_id TEXT,
  data_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  action TEXT,
  signature_ts TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('verified_pending_resource_fetch','ignored','failed')),
  tenant_id TEXT,
  checkout_session_id TEXT,
  detail_code TEXT,
  UNIQUE(provider,request_id),
  FOREIGN KEY (checkout_session_id) REFERENCES academy_checkout_sessions(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_receipts_data
ON academy_payment_webhook_receipts(provider,data_id,received_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_receipts_status
ON academy_payment_webhook_receipts(status,received_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_payment_webhook_receipt_insert_guard
BEFORE INSERT ON academy_payment_webhook_receipts
BEGIN
  SELECT CASE WHEN length(trim(NEW.request_id))=0 OR length(trim(NEW.data_id))=0 OR length(trim(NEW.notification_type))=0
    THEN RAISE(ABORT,'webhook receipt requires request/data/type') END;
  SELECT CASE WHEN length(NEW.body_hash)!=64 OR NEW.body_hash GLOB '*[^0-9a-f]*'
    THEN RAISE(ABORT,'webhook receipt requires sha256 body hash') END;
  SELECT CASE WHEN length(trim(NEW.signature_ts))=0
    THEN RAISE(ABORT,'webhook receipt requires signature timestamp') END;
  SELECT CASE WHEN NEW.checkout_session_id IS NOT NULL AND (
    NEW.tenant_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM academy_checkout_sessions c
      WHERE c.id=NEW.checkout_session_id AND c.tenant_id=NEW.tenant_id
    )
  ) THEN RAISE(ABORT,'webhook receipt checkout correlation mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_webhook_receipt_immutable
BEFORE UPDATE ON academy_payment_webhook_receipts
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.provider!=OLD.provider OR NEW.request_id!=OLD.request_id
    OR NEW.notification_id IS NOT OLD.notification_id OR NEW.data_id!=OLD.data_id
    OR NEW.notification_type!=OLD.notification_type OR NEW.action IS NOT OLD.action
    OR NEW.signature_ts!=OLD.signature_ts OR NEW.body_hash!=OLD.body_hash
    OR NEW.verified_at!=OLD.verified_at OR NEW.received_at!=OLD.received_at
    THEN RAISE(ABORT,'verified webhook receipt evidence is immutable') END;
  SELECT CASE WHEN NEW.checkout_session_id IS NOT NULL AND (
    NEW.tenant_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM academy_checkout_sessions c
      WHERE c.id=NEW.checkout_session_id AND c.tenant_id=NEW.tenant_id
    )
  ) THEN RAISE(ABORT,'webhook receipt checkout correlation mismatch') END;
END;
