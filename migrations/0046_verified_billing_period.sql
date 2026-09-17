PRAGMA foreign_keys = ON;

ALTER TABLE academy_payment_events ADD COLUMN provider_occurred_at TEXT;

DROP TRIGGER IF EXISTS trg_payment_event_period_guard;
CREATE TRIGGER trg_payment_event_period_guard
BEFORE INSERT ON academy_payment_events
BEGIN
  SELECT CASE WHEN NEW.event_type='confirmed' AND (
    NEW.provider_payment_id IS NULL OR NEW.provider_subscription_id IS NULL
    OR (NEW.period_start IS NULL AND NEW.provider_occurred_at IS NULL)
  ) THEN RAISE(ABORT,'confirmed payment event requires provider payment/subscription and canonical timing evidence') END;
  SELECT CASE WHEN NEW.period_start IS NOT NULL AND datetime(NEW.period_start) IS NULL
    THEN RAISE(ABORT,'provider period start is invalid') END;
  SELECT CASE WHEN NEW.provider_occurred_at IS NOT NULL AND datetime(NEW.provider_occurred_at) IS NULL
    THEN RAISE(ABORT,'provider occurred at is invalid') END;
  SELECT CASE WHEN NEW.period_end IS NOT NULL AND (NEW.period_start IS NULL OR datetime(NEW.period_end) IS NULL)
    THEN RAISE(ABORT,'provider period end requires a valid provider period start') END;
  SELECT CASE WHEN NEW.period_end IS NOT NULL AND datetime(NEW.period_end)<=datetime(NEW.period_start)
    THEN RAISE(ABORT,'provider payment period is invalid') END;
END;

DROP TRIGGER IF EXISTS trg_payment_event_immutable;
CREATE TRIGGER trg_payment_event_immutable
BEFORE UPDATE ON academy_payment_events
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.checkout_session_id!=OLD.checkout_session_id
    OR NEW.provider!=OLD.provider OR NEW.provider_event_id!=OLD.provider_event_id OR NEW.event_type!=OLD.event_type
    OR NEW.provider_payment_id IS NOT OLD.provider_payment_id OR NEW.provider_subscription_id IS NOT OLD.provider_subscription_id
    OR NEW.provider_occurred_at IS NOT OLD.provider_occurred_at
    OR NEW.period_start IS NOT OLD.period_start OR NEW.period_end IS NOT OLD.period_end
    OR NEW.amount_cents!=OLD.amount_cents OR NEW.currency!=OLD.currency OR NEW.payload_hash!=OLD.payload_hash
    OR NEW.verified_at!=OLD.verified_at OR NEW.received_at!=OLD.received_at
    THEN RAISE(ABORT,'verified payment event evidence is immutable') END;
END;

CREATE TABLE IF NOT EXISTS academy_subscription_billing_periods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  checkout_session_id TEXT NOT NULL,
  payment_event_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  provider_subscription_id TEXT NOT NULL,
  billing_interval TEXT NOT NULL CHECK(billing_interval IN ('monthly','annual')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  period_start_source TEXT NOT NULL CHECK(period_start_source IN ('provider_period_start','provider_occurred_at')),
  period_end_source TEXT NOT NULL CHECK(period_end_source='academy_derived_from_checkout_interval'),
  provider_reported_period_start TEXT,
  provider_reported_period_end TEXT,
  provider_period_end_matches INTEGER CHECK(provider_period_end_matches IS NULL OR provider_period_end_matches IN (0,1)),
  derivation_version INTEGER NOT NULL DEFAULT 1 CHECK(derivation_version=1),
  derived_at TEXT NOT NULL,
  UNIQUE (tenant_id,provider,provider_event_id),
  FOREIGN KEY (subscription_id) REFERENCES academy_subscriptions(id) ON DELETE RESTRICT,
  FOREIGN KEY (checkout_session_id) REFERENCES academy_checkout_sessions(id) ON DELETE RESTRICT,
  FOREIGN KEY (payment_event_id) REFERENCES academy_payment_events(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_subscription_billing_periods_subscription
ON academy_subscription_billing_periods(tenant_id,subscription_id,period_start DESC);

CREATE TRIGGER IF NOT EXISTS trg_subscription_billing_period_insert_guard
BEFORE INSERT ON academy_subscription_billing_periods
BEGIN
  SELECT CASE WHEN datetime(NEW.period_start) IS NULL OR datetime(NEW.period_end) IS NULL
    OR datetime(NEW.period_end)<=datetime(NEW.period_start)
    THEN RAISE(ABORT,'derived billing period is invalid') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_checkout_sessions c
    WHERE c.id=NEW.checkout_session_id AND c.tenant_id=NEW.tenant_id
      AND c.subscription_id=NEW.subscription_id AND c.billing_interval=NEW.billing_interval
  ) THEN RAISE(ABORT,'billing period checkout/cadence mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_payment_events e
    WHERE e.id=NEW.payment_event_id AND e.tenant_id=NEW.tenant_id
      AND e.checkout_session_id=NEW.checkout_session_id AND e.event_type='confirmed'
      AND e.provider=NEW.provider AND e.provider_event_id=NEW.provider_event_id
      AND e.provider_payment_id=NEW.provider_payment_id AND e.provider_subscription_id=NEW.provider_subscription_id
  ) THEN RAISE(ABORT,'billing period verified payment evidence mismatch') END;
  SELECT CASE WHEN NEW.period_start_source='provider_period_start' AND NOT EXISTS (
    SELECT 1 FROM academy_payment_events e WHERE e.id=NEW.payment_event_id
      AND e.period_start IS NOT NULL AND julianday(e.period_start)=julianday(NEW.period_start)
  ) THEN RAISE(ABORT,'billing period start does not match provider period start') END;
  SELECT CASE WHEN NEW.period_start_source='provider_occurred_at' AND NOT EXISTS (
    SELECT 1 FROM academy_payment_events e WHERE e.id=NEW.payment_event_id
      AND e.provider_occurred_at IS NOT NULL AND julianday(e.provider_occurred_at)=julianday(NEW.period_start)
  ) THEN RAISE(ABORT,'billing period start does not match provider occurrence') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_subscription_billing_period_immutable
BEFORE UPDATE ON academy_subscription_billing_periods
BEGIN
  SELECT RAISE(ABORT,'derived billing period evidence is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_subscription_billing_period_no_delete
BEFORE DELETE ON academy_subscription_billing_periods
BEGIN
  SELECT RAISE(ABORT,'derived billing period evidence cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS trg_priced_subscription_requires_derived_period_insert
BEFORE INSERT ON academy_subscriptions
WHEN NEW.status='active' AND EXISTS (
  SELECT 1 FROM academy_plans p WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id AND p.commercial_mode='priced'
)
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_subscription_billing_periods bp
    WHERE bp.tenant_id=NEW.tenant_id AND bp.subscription_id=NEW.id
      AND julianday(bp.period_start)=julianday(NEW.current_period_start)
      AND julianday(bp.period_end)=julianday(NEW.current_period_end)
  ) THEN RAISE(ABORT,'active priced subscription requires derived billing period evidence') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_priced_subscription_requires_derived_period_update
BEFORE UPDATE ON academy_subscriptions
WHEN NEW.status='active' AND EXISTS (
  SELECT 1 FROM academy_plans p WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id AND p.commercial_mode='priced'
)
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_subscription_billing_periods bp
    WHERE bp.tenant_id=NEW.tenant_id AND bp.subscription_id=NEW.id
      AND julianday(bp.period_start)=julianday(NEW.current_period_start)
      AND julianday(bp.period_end)=julianday(NEW.current_period_end)
  ) THEN RAISE(ABORT,'active priced subscription requires derived billing period evidence') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_subscription_entitlement_period_insert
BEFORE INSERT ON academy_entitlements
WHEN NEW.source_type='subscription' AND NEW.status='active'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_subscriptions s
    WHERE s.id=NEW.source_id AND s.tenant_id=NEW.tenant_id AND s.status='active'
      AND julianday(s.current_period_start)=julianday(NEW.starts_at)
      AND julianday(s.current_period_end)=julianday(NEW.ends_at)
  ) THEN RAISE(ABORT,'active subscription entitlement period must match subscription') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_subscription_entitlement_period_update
BEFORE UPDATE ON academy_entitlements
WHEN NEW.source_type='subscription' AND NEW.status='active'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_subscriptions s
    WHERE s.id=NEW.source_id AND s.tenant_id=NEW.tenant_id AND s.status='active'
      AND julianday(s.current_period_start)=julianday(NEW.starts_at)
      AND julianday(s.current_period_end)=julianday(NEW.ends_at)
  ) THEN RAISE(ABORT,'active subscription entitlement period must match subscription') END;
END;
