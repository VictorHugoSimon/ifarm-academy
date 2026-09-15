PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_subscription_billing_period_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  checkout_session_id TEXT NOT NULL,
  payment_event_id TEXT,
  provider TEXT NOT NULL,
  provider_resource_type TEXT NOT NULL,
  provider_resource_id TEXT NOT NULL,
  provider_subscription_id TEXT NOT NULL,
  evidence_status TEXT NOT NULL CHECK(evidence_status IN ('complete','partial','unavailable')),
  period_start TEXT,
  period_end TEXT,
  observed_at TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'canonical_provider_resource' CHECK(source='canonical_provider_resource'),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id,provider,provider_resource_type,provider_resource_id,payload_hash),
  FOREIGN KEY (subscription_id) REFERENCES academy_subscriptions(id) ON DELETE RESTRICT,
  FOREIGN KEY (checkout_session_id) REFERENCES academy_checkout_sessions(id) ON DELETE RESTRICT,
  FOREIGN KEY (payment_event_id) REFERENCES academy_payment_events(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_billing_period_evidence_subscription
ON academy_subscription_billing_period_evidence(tenant_id,subscription_id,observed_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_billing_period_evidence_insert_guard
BEFORE INSERT ON academy_subscription_billing_period_evidence
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_checkout_sessions c
    WHERE c.id=NEW.checkout_session_id AND c.tenant_id=NEW.tenant_id AND c.subscription_id=NEW.subscription_id
  ) THEN RAISE(ABORT,'billing period evidence checkout/subscription mismatch') END;

  SELECT CASE WHEN NEW.payment_event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_payment_events e
    WHERE e.id=NEW.payment_event_id AND e.tenant_id=NEW.tenant_id AND e.checkout_session_id=NEW.checkout_session_id
  ) THEN RAISE(ABORT,'billing period evidence payment event mismatch') END;

  SELECT CASE WHEN length(trim(NEW.provider_resource_type))=0 OR length(trim(NEW.provider_resource_id))=0
    OR length(trim(NEW.provider_subscription_id))=0
    THEN RAISE(ABORT,'billing period evidence requires provider resource identity') END;

  SELECT CASE WHEN length(NEW.payload_hash)!=64 OR NEW.payload_hash GLOB '*[^0-9a-f]*'
    THEN RAISE(ABORT,'billing period evidence requires sha256 payload hash') END;

  SELECT CASE
    WHEN NEW.evidence_status='complete' AND (NEW.period_start IS NULL OR NEW.period_end IS NULL)
      THEN RAISE(ABORT,'complete billing period evidence requires start and end')
    WHEN NEW.evidence_status='partial' AND ((NEW.period_start IS NULL AND NEW.period_end IS NULL) OR (NEW.period_start IS NOT NULL AND NEW.period_end IS NOT NULL))
      THEN RAISE(ABORT,'partial billing period evidence requires exactly one boundary')
    WHEN NEW.evidence_status='unavailable' AND (NEW.period_start IS NOT NULL OR NEW.period_end IS NOT NULL)
      THEN RAISE(ABORT,'unavailable billing period evidence cannot contain boundaries')
  END;

  SELECT CASE WHEN NEW.period_start IS NOT NULL AND datetime(NEW.period_start) IS NULL
    THEN RAISE(ABORT,'billing period start must be ISO date-like') END;
  SELECT CASE WHEN NEW.period_end IS NOT NULL AND datetime(NEW.period_end) IS NULL
    THEN RAISE(ABORT,'billing period end must be ISO date-like') END;
  SELECT CASE WHEN NEW.period_start IS NOT NULL AND NEW.period_end IS NOT NULL AND datetime(NEW.period_end)<=datetime(NEW.period_start)
    THEN RAISE(ABORT,'billing period evidence range is invalid') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_billing_period_evidence_immutable
BEFORE UPDATE ON academy_subscription_billing_period_evidence
BEGIN
  SELECT RAISE(ABORT,'billing period evidence is append-only');
END;

DROP TRIGGER IF EXISTS trg_payment_event_period_guard;
CREATE TRIGGER trg_payment_event_period_guard
BEFORE INSERT ON academy_payment_events
BEGIN
  SELECT CASE WHEN NEW.event_type='confirmed' AND (
    NEW.provider_payment_id IS NULL OR NEW.provider_subscription_id IS NULL
  ) THEN RAISE(ABORT,'confirmed payment event requires provider payment/subscription evidence') END;
  SELECT CASE WHEN NEW.period_start IS NOT NULL AND datetime(NEW.period_start) IS NULL
    THEN RAISE(ABORT,'payment period start must be ISO date-like') END;
  SELECT CASE WHEN NEW.period_end IS NOT NULL AND datetime(NEW.period_end) IS NULL
    THEN RAISE(ABORT,'payment period end must be ISO date-like') END;
  SELECT CASE WHEN NEW.period_start IS NOT NULL AND NEW.period_end IS NOT NULL AND datetime(NEW.period_end)<=datetime(NEW.period_start)
    THEN RAISE(ABORT,'confirmed payment period is invalid') END;
END;

DROP TRIGGER IF EXISTS trg_subscription_tenant_insert;
CREATE TRIGGER trg_subscription_tenant_insert
BEFORE INSERT ON academy_subscriptions
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM academy_plans p WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'subscription tenant/plan mismatch') END;
  SELECT CASE WHEN NEW.price_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_plan_prices pp WHERE pp.id=NEW.price_id AND pp.plan_id=NEW.plan_id AND pp.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'subscription price mismatch') END;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM academy_plans p WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id AND p.commercial_mode='priced') AND NEW.price_id IS NULL
    THEN RAISE(ABORT,'priced subscription requires price') END;
  SELECT CASE WHEN NEW.status='active' AND (NEW.activation_reference IS NULL OR NEW.started_at IS NULL)
    THEN RAISE(ABORT,'active subscription requires explicit activation reference') END;
  SELECT CASE WHEN NEW.status='active' AND EXISTS (
    SELECT 1 FROM academy_plans p WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id AND p.commercial_mode='priced'
  ) AND (NEW.provider IS NULL OR NEW.provider_subscription_id IS NULL)
    THEN RAISE(ABORT,'active priced subscription requires verified provider activation') END;
END;

DROP TRIGGER IF EXISTS trg_subscription_activation_update;
CREATE TRIGGER trg_subscription_activation_update
BEFORE UPDATE ON academy_subscriptions
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.user_id!=OLD.user_id OR NEW.plan_id!=OLD.plan_id
    THEN RAISE(ABORT,'subscription identity is immutable') END;
  SELECT CASE WHEN NEW.price_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_plan_prices pp WHERE pp.id=NEW.price_id AND pp.plan_id=NEW.plan_id AND pp.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'subscription price mismatch') END;
  SELECT CASE WHEN NEW.status='active' AND (NEW.activation_reference IS NULL OR NEW.started_at IS NULL)
    THEN RAISE(ABORT,'active subscription requires explicit activation reference') END;
  SELECT CASE WHEN NEW.status='active' AND EXISTS (
    SELECT 1 FROM academy_plans p WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id AND p.commercial_mode='priced'
  ) AND (NEW.provider IS NULL OR NEW.provider_subscription_id IS NULL)
    THEN RAISE(ABORT,'active priced subscription requires verified provider activation') END;
END;
