PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_subscription_lifecycle_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  checkout_session_id TEXT NOT NULL,
  webhook_receipt_id TEXT,
  provider TEXT NOT NULL,
  provider_resource_type TEXT NOT NULL,
  provider_resource_id TEXT NOT NULL,
  provider_status TEXT NOT NULL,
  observation TEXT NOT NULL CHECK(observation IN ('provider_authorized','provider_pending','provider_paused','provider_cancelled','provider_unknown')),
  payload_hash TEXT NOT NULL,
  occurred_at TEXT,
  observed_at TEXT NOT NULL,
  access_policy_action TEXT NOT NULL DEFAULT 'none_policy_tbd' CHECK(access_policy_action='none_policy_tbd'),
  UNIQUE (tenant_id,provider,provider_resource_type,provider_resource_id,provider_status,payload_hash),
  FOREIGN KEY (subscription_id) REFERENCES academy_subscriptions(id) ON DELETE RESTRICT,
  FOREIGN KEY (checkout_session_id) REFERENCES academy_checkout_sessions(id) ON DELETE RESTRICT,
  FOREIGN KEY (webhook_receipt_id) REFERENCES academy_payment_webhook_receipts(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_subscription_lifecycle_subscription
ON academy_subscription_lifecycle_events(tenant_id,subscription_id,observed_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_subscription_lifecycle_insert_guard
BEFORE INSERT ON academy_subscription_lifecycle_events
BEGIN
  SELECT CASE WHEN length(trim(NEW.provider))=0 OR length(trim(NEW.provider_resource_id))=0
    OR length(trim(NEW.provider_status))=0 OR length(NEW.payload_hash)!=64
    THEN RAISE(ABORT,'subscription lifecycle requires canonical provider evidence') END;
  SELECT CASE WHEN NEW.occurred_at IS NOT NULL AND datetime(NEW.occurred_at) IS NULL
    THEN RAISE(ABORT,'subscription lifecycle occurred_at is invalid') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_checkout_sessions c
    WHERE c.id=NEW.checkout_session_id AND c.tenant_id=NEW.tenant_id AND c.subscription_id=NEW.subscription_id
  ) THEN RAISE(ABORT,'subscription lifecycle checkout/subscription mismatch') END;
  SELECT CASE WHEN NEW.webhook_receipt_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_payment_webhook_receipts r
    WHERE r.id=NEW.webhook_receipt_id AND r.tenant_id=NEW.tenant_id AND r.checkout_session_id=NEW.checkout_session_id
      AND r.canonical_resource_type=NEW.provider_resource_type AND r.canonical_resource_id=NEW.provider_resource_id
      AND r.canonical_status=NEW.provider_status AND r.canonical_resource_hash=NEW.payload_hash
  ) THEN RAISE(ABORT,'subscription lifecycle webhook evidence mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_subscription_lifecycle_immutable
BEFORE UPDATE ON academy_subscription_lifecycle_events
BEGIN
  SELECT RAISE(ABORT,'subscription lifecycle evidence is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_subscription_lifecycle_no_delete
BEFORE DELETE ON academy_subscription_lifecycle_events
BEGIN
  SELECT RAISE(ABORT,'subscription lifecycle evidence cannot be deleted');
END;
