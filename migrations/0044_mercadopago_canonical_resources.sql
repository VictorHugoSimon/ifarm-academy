PRAGMA foreign_keys = ON;

ALTER TABLE academy_payment_webhook_receipts RENAME TO academy_payment_webhook_receipts_v43;

CREATE TABLE academy_payment_webhook_receipts (
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
  status TEXT NOT NULL CHECK(status IN ('verified_pending_resource_fetch','canonical_verified','processed','ignored','failed')),
  tenant_id TEXT,
  checkout_session_id TEXT,
  detail_code TEXT,
  canonical_resource_type TEXT,
  canonical_resource_id TEXT,
  canonical_status TEXT,
  canonical_external_reference TEXT,
  canonical_amount_cents INTEGER,
  canonical_currency TEXT,
  canonical_resource_hash TEXT,
  canonical_fetched_at TEXT,
  canonical_occurred_at TEXT,
  canonical_period_start TEXT,
  canonical_period_end TEXT,
  provider_payment_id TEXT,
  provider_subscription_id TEXT,
  fetch_attempts INTEGER NOT NULL DEFAULT 0 CHECK(fetch_attempts >= 0),
  last_fetch_at TEXT,
  last_error_code TEXT,
  UNIQUE(provider,request_id),
  FOREIGN KEY (checkout_session_id) REFERENCES academy_checkout_sessions(id) ON DELETE RESTRICT
);

INSERT INTO academy_payment_webhook_receipts (
  id,provider,request_id,notification_id,data_id,notification_type,action,signature_ts,body_hash,
  verified_at,received_at,status,tenant_id,checkout_session_id,detail_code
)
SELECT id,provider,request_id,notification_id,data_id,notification_type,action,signature_ts,body_hash,
  verified_at,received_at,status,tenant_id,checkout_session_id,detail_code
FROM academy_payment_webhook_receipts_v43;

DROP TABLE academy_payment_webhook_receipts_v43;

CREATE INDEX idx_payment_webhook_receipts_data
ON academy_payment_webhook_receipts(provider,data_id,received_at DESC);

CREATE INDEX idx_payment_webhook_receipts_status
ON academy_payment_webhook_receipts(status,received_at DESC);

CREATE INDEX idx_payment_webhook_receipts_checkout
ON academy_payment_webhook_receipts(tenant_id,checkout_session_id,received_at DESC);

CREATE TRIGGER trg_payment_webhook_receipt_insert_guard
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

CREATE TRIGGER trg_payment_webhook_receipt_evidence_immutable
BEFORE UPDATE ON academy_payment_webhook_receipts
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.provider!=OLD.provider OR NEW.request_id!=OLD.request_id
    OR NEW.notification_id IS NOT OLD.notification_id OR NEW.data_id!=OLD.data_id
    OR NEW.notification_type!=OLD.notification_type OR NEW.action IS NOT OLD.action
    OR NEW.signature_ts!=OLD.signature_ts OR NEW.body_hash!=OLD.body_hash
    OR NEW.verified_at!=OLD.verified_at OR NEW.received_at!=OLD.received_at
    THEN RAISE(ABORT,'verified webhook receipt evidence is immutable') END;

  SELECT CASE WHEN OLD.canonical_resource_hash IS NOT NULL AND (
    NEW.canonical_resource_type IS NOT OLD.canonical_resource_type
    OR NEW.canonical_resource_id IS NOT OLD.canonical_resource_id
    OR NEW.canonical_status IS NOT OLD.canonical_status
    OR NEW.canonical_external_reference IS NOT OLD.canonical_external_reference
    OR NEW.canonical_amount_cents IS NOT OLD.canonical_amount_cents
    OR NEW.canonical_currency IS NOT OLD.canonical_currency
    OR NEW.canonical_resource_hash IS NOT OLD.canonical_resource_hash
    OR NEW.canonical_fetched_at IS NOT OLD.canonical_fetched_at
    OR NEW.canonical_occurred_at IS NOT OLD.canonical_occurred_at
    OR NEW.canonical_period_start IS NOT OLD.canonical_period_start
    OR NEW.canonical_period_end IS NOT OLD.canonical_period_end
    OR NEW.provider_payment_id IS NOT OLD.provider_payment_id
    OR NEW.provider_subscription_id IS NOT OLD.provider_subscription_id
  ) THEN RAISE(ABORT,'canonical provider evidence is immutable once recorded') END;

  SELECT CASE WHEN NEW.canonical_resource_hash IS NOT NULL AND (
    length(NEW.canonical_resource_hash)!=64 OR NEW.canonical_resource_hash GLOB '*[^0-9a-f]*'
    OR NEW.canonical_resource_type IS NULL OR NEW.canonical_resource_id IS NULL OR NEW.canonical_fetched_at IS NULL
  ) THEN RAISE(ABORT,'canonical provider evidence is incomplete') END;

  SELECT CASE WHEN NEW.canonical_amount_cents IS NOT NULL AND NEW.canonical_amount_cents<=0
    THEN RAISE(ABORT,'canonical amount must be positive') END;

  SELECT CASE WHEN NEW.canonical_currency IS NOT NULL AND (
    length(NEW.canonical_currency)!=3 OR NEW.canonical_currency GLOB '*[^A-Z]*'
  ) THEN RAISE(ABORT,'canonical currency must be ISO-4217-like') END;

  SELECT CASE WHEN NEW.checkout_session_id IS NOT NULL AND (
    NEW.tenant_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM academy_checkout_sessions c
      WHERE c.id=NEW.checkout_session_id AND c.tenant_id=NEW.tenant_id
    )
  ) THEN RAISE(ABORT,'webhook receipt checkout correlation mismatch') END;

  SELECT CASE
    WHEN OLD.status='verified_pending_resource_fetch' AND NEW.status NOT IN ('verified_pending_resource_fetch','canonical_verified','processed','failed')
      THEN RAISE(ABORT,'invalid webhook receipt status transition')
    WHEN OLD.status='canonical_verified' AND NEW.status NOT IN ('canonical_verified','processed','failed')
      THEN RAISE(ABORT,'invalid webhook receipt status transition')
    WHEN OLD.status='processed' AND NEW.status!='processed'
      THEN RAISE(ABORT,'processed webhook receipt is terminal')
    WHEN OLD.status='ignored' AND NEW.status!='ignored'
      THEN RAISE(ABORT,'ignored webhook receipt is terminal')
    WHEN OLD.status='failed' AND NEW.status!='failed'
      THEN RAISE(ABORT,'failed webhook receipt is terminal')
  END;
END;
