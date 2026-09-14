PRAGMA foreign_keys = ON;

ALTER TABLE academy_payment_events ADD COLUMN provider_subscription_id TEXT;
ALTER TABLE academy_payment_events ADD COLUMN period_start TEXT;
ALTER TABLE academy_payment_events ADD COLUMN period_end TEXT;

DROP TRIGGER IF EXISTS trg_payment_event_immutable;

CREATE TRIGGER IF NOT EXISTS trg_payment_event_period_guard
BEFORE INSERT ON academy_payment_events
BEGIN
  SELECT CASE WHEN NEW.event_type='confirmed' AND (
    NEW.provider_payment_id IS NULL OR NEW.provider_subscription_id IS NULL OR NEW.period_start IS NULL OR NEW.period_end IS NULL
  ) THEN RAISE(ABORT,'confirmed payment event requires provider payment/subscription and period evidence') END;
  SELECT CASE WHEN NEW.event_type='confirmed' AND datetime(NEW.period_end)<=datetime(NEW.period_start)
    THEN RAISE(ABORT,'confirmed payment period is invalid') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_event_immutable
BEFORE UPDATE ON academy_payment_events
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.checkout_session_id!=OLD.checkout_session_id
    OR NEW.provider!=OLD.provider OR NEW.provider_event_id!=OLD.provider_event_id OR NEW.event_type!=OLD.event_type
    OR NEW.provider_payment_id IS NOT OLD.provider_payment_id OR NEW.provider_subscription_id IS NOT OLD.provider_subscription_id
    OR NEW.period_start IS NOT OLD.period_start OR NEW.period_end IS NOT OLD.period_end
    OR NEW.amount_cents!=OLD.amount_cents OR NEW.currency!=OLD.currency OR NEW.payload_hash!=OLD.payload_hash
    OR NEW.verified_at!=OLD.verified_at OR NEW.received_at!=OLD.received_at
    THEN RAISE(ABORT,'verified payment event evidence is immutable') END;
END;

CREATE TABLE IF NOT EXISTS academy_payment_processing_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  checkout_session_id TEXT NOT NULL,
  payment_event_id TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('applied','idempotent','rejected')),
  detail_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (checkout_session_id) REFERENCES academy_checkout_sessions(id) ON DELETE RESTRICT,
  FOREIGN KEY (payment_event_id) REFERENCES academy_payment_events(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_payment_processing_checkout
ON academy_payment_processing_log(tenant_id,checkout_session_id,created_at DESC);
