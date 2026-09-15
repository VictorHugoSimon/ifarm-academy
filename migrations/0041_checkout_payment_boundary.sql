PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_checkout_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  price_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  billing_interval TEXT NOT NULL CHECK(billing_interval IN ('monthly','annual')),
  price_unit TEXT NOT NULL CHECK(price_unit IN ('subscription','per_user')),
  price_version INTEGER NOT NULL CHECK(price_version > 0),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','awaiting_provider','pending','confirmed','failed','cancelled','expired')),
  provider TEXT,
  provider_checkout_id TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES academy_plans(id) ON DELETE RESTRICT,
  FOREIGN KEY (price_id) REFERENCES academy_plan_prices(id) ON DELETE RESTRICT,
  FOREIGN KEY (subscription_id) REFERENCES academy_subscriptions(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_open_plan_price
ON academy_checkout_sessions(tenant_id,user_id,plan_id,price_id)
WHERE status IN ('created','awaiting_provider','pending');
CREATE INDEX IF NOT EXISTS idx_checkout_user ON academy_checkout_sessions(tenant_id,user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_provider ON academy_checkout_sessions(tenant_id,provider,provider_checkout_id);

CREATE TABLE IF NOT EXISTS academy_payment_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  checkout_session_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('pending','confirmed','failed','cancelled','refunded')),
  provider_payment_id TEXT,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'received' CHECK(processing_status IN ('received','processed','ignored','failed')),
  processed_at TEXT,
  error_code TEXT,
  UNIQUE (tenant_id,provider,provider_event_id),
  FOREIGN KEY (checkout_session_id) REFERENCES academy_checkout_sessions(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_payment_events_checkout
ON academy_payment_events(tenant_id,checkout_session_id,received_at DESC);

CREATE TABLE IF NOT EXISTS academy_payment_state (
  checkout_session_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','failed','cancelled','refunded')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL,
  provider TEXT,
  provider_payment_id TEXT,
  last_event_id TEXT,
  confirmed_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (checkout_session_id) REFERENCES academy_checkout_sessions(id) ON DELETE RESTRICT,
  FOREIGN KEY (last_event_id) REFERENCES academy_payment_events(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS academy_entitlements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('subscription','manual_contract','free_plan')),
  source_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended','revoked','expired')),
  activation_evidence_type TEXT,
  activation_reference TEXT,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id,user_id,source_type,source_id),
  FOREIGN KEY (plan_id) REFERENCES academy_plans(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_entitlements_user
ON academy_entitlements(tenant_id,user_id,status,updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_checkout_insert_guard
BEFORE INSERT ON academy_checkout_sessions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_plans p
    WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id AND p.status='public' AND p.commercial_mode='priced'
  ) THEN RAISE(ABORT,'checkout requires a public priced plan in the same tenant') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_plan_prices pp
    WHERE pp.id=NEW.price_id AND pp.tenant_id=NEW.tenant_id AND pp.plan_id=NEW.plan_id
      AND pp.status='active' AND pp.billing_interval=NEW.billing_interval AND pp.price_unit=NEW.price_unit
      AND pp.version=NEW.price_version AND pp.amount_cents=NEW.amount_cents AND pp.currency=NEW.currency
      AND (pp.valid_from IS NULL OR datetime(pp.valid_from)<=datetime('now'))
      AND (pp.valid_until IS NULL OR datetime(pp.valid_until)>datetime('now'))
  ) THEN RAISE(ABORT,'checkout price snapshot must match the active server price') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_subscriptions s
    WHERE s.id=NEW.subscription_id AND s.tenant_id=NEW.tenant_id AND s.user_id=NEW.user_id
      AND s.plan_id=NEW.plan_id AND s.price_id=NEW.price_id AND s.status='pending_payment'
  ) THEN RAISE(ABORT,'checkout subscription mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_checkout_snapshot_immutable
BEFORE UPDATE ON academy_checkout_sessions
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.user_id!=OLD.user_id
    OR NEW.plan_id!=OLD.plan_id OR NEW.price_id!=OLD.price_id OR NEW.subscription_id!=OLD.subscription_id
    OR NEW.billing_interval!=OLD.billing_interval OR NEW.price_unit!=OLD.price_unit
    OR NEW.price_version!=OLD.price_version OR NEW.amount_cents!=OLD.amount_cents OR NEW.currency!=OLD.currency
    OR NEW.created_at!=OLD.created_at
    THEN RAISE(ABORT,'checkout commercial snapshot is immutable') END;
  SELECT CASE WHEN OLD.status='confirmed' AND NEW.status NOT IN ('confirmed')
    THEN RAISE(ABORT,'confirmed checkout cannot be reopened') END;
  SELECT CASE WHEN OLD.status IN ('cancelled','expired') AND NEW.status!=OLD.status
    THEN RAISE(ABORT,'terminal checkout cannot be reopened') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_event_insert_guard
BEFORE INSERT ON academy_payment_events
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_checkout_sessions c
    WHERE c.id=NEW.checkout_session_id AND c.tenant_id=NEW.tenant_id
      AND c.amount_cents=NEW.amount_cents AND c.currency=NEW.currency
  ) THEN RAISE(ABORT,'payment event checkout/amount mismatch') END;
  SELECT CASE WHEN length(trim(NEW.provider_event_id))=0 OR length(trim(NEW.provider))=0
    THEN RAISE(ABORT,'payment event requires provider identifiers') END;
  SELECT CASE WHEN length(trim(NEW.payload_hash))<32
    THEN RAISE(ABORT,'verified payment event requires payload hash') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_event_immutable
BEFORE UPDATE ON academy_payment_events
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.checkout_session_id!=OLD.checkout_session_id
    OR NEW.provider!=OLD.provider OR NEW.provider_event_id!=OLD.provider_event_id OR NEW.event_type!=OLD.event_type
    OR NEW.provider_payment_id IS NOT OLD.provider_payment_id OR NEW.amount_cents!=OLD.amount_cents
    OR NEW.currency!=OLD.currency OR NEW.payload_hash!=OLD.payload_hash OR NEW.verified_at!=OLD.verified_at
    OR NEW.received_at!=OLD.received_at
    THEN RAISE(ABORT,'verified payment event evidence is immutable') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_state_insert_guard
BEFORE INSERT ON academy_payment_state
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_checkout_sessions c
    WHERE c.id=NEW.checkout_session_id AND c.tenant_id=NEW.tenant_id
      AND c.amount_cents=NEW.amount_cents AND c.currency=NEW.currency
  ) THEN RAISE(ABORT,'payment state checkout mismatch') END;
  SELECT CASE WHEN NEW.status='confirmed' AND (NEW.last_event_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM academy_payment_events e
    WHERE e.id=NEW.last_event_id AND e.tenant_id=NEW.tenant_id AND e.checkout_session_id=NEW.checkout_session_id
      AND e.event_type='confirmed' AND e.verified_at IS NOT NULL
  )) THEN RAISE(ABORT,'confirmed payment state requires verified confirmation event') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_state_update_guard
BEFORE UPDATE ON academy_payment_state
BEGIN
  SELECT CASE WHEN NEW.checkout_session_id!=OLD.checkout_session_id OR NEW.tenant_id!=OLD.tenant_id
    OR NEW.amount_cents!=OLD.amount_cents OR NEW.currency!=OLD.currency
    THEN RAISE(ABORT,'payment state identity/snapshot is immutable') END;
  SELECT CASE WHEN NEW.status='confirmed' AND (NEW.last_event_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM academy_payment_events e
    WHERE e.id=NEW.last_event_id AND e.tenant_id=NEW.tenant_id AND e.checkout_session_id=NEW.checkout_session_id
      AND e.event_type='confirmed' AND e.verified_at IS NOT NULL
  )) THEN RAISE(ABORT,'confirmed payment state requires verified confirmation event') END;
  SELECT CASE WHEN OLD.status='refunded' AND NEW.status!='refunded'
    THEN RAISE(ABORT,'refunded payment cannot be reopened') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_entitlement_insert_guard
BEFORE INSERT ON academy_entitlements
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_plans p WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'entitlement tenant/plan mismatch') END;
  SELECT CASE WHEN NEW.status='active' AND (NEW.activation_reference IS NULL OR NEW.activation_evidence_type IS NULL OR NEW.starts_at IS NULL)
    THEN RAISE(ABORT,'active entitlement requires explicit activation evidence') END;
  SELECT CASE WHEN NEW.source_type='subscription' AND NOT EXISTS (
    SELECT 1 FROM academy_subscriptions s
    WHERE s.id=NEW.source_id AND s.tenant_id=NEW.tenant_id AND s.user_id=NEW.user_id AND s.plan_id=NEW.plan_id
  ) THEN RAISE(ABORT,'subscription entitlement source mismatch') END;
  SELECT CASE WHEN NEW.source_type='subscription' AND NEW.status='active' AND NOT EXISTS (
    SELECT 1 FROM academy_subscriptions s
    WHERE s.id=NEW.source_id AND s.tenant_id=NEW.tenant_id AND s.user_id=NEW.user_id AND s.plan_id=NEW.plan_id AND s.status='active'
  ) THEN RAISE(ABORT,'active subscription entitlement requires active subscription') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_entitlement_update_guard
BEFORE UPDATE ON academy_entitlements
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.user_id!=OLD.user_id
    OR NEW.source_type!=OLD.source_type OR NEW.source_id!=OLD.source_id OR NEW.plan_id!=OLD.plan_id
    THEN RAISE(ABORT,'entitlement identity/source is immutable') END;
  SELECT CASE WHEN NEW.status='active' AND (NEW.activation_reference IS NULL OR NEW.activation_evidence_type IS NULL OR NEW.starts_at IS NULL)
    THEN RAISE(ABORT,'active entitlement requires explicit activation evidence') END;
  SELECT CASE WHEN NEW.source_type='subscription' AND NEW.status='active' AND NOT EXISTS (
    SELECT 1 FROM academy_subscriptions s
    WHERE s.id=NEW.source_id AND s.tenant_id=NEW.tenant_id AND s.user_id=NEW.user_id AND s.plan_id=NEW.plan_id AND s.status='active'
  ) THEN RAISE(ABORT,'active subscription entitlement requires active subscription') END;
END;
