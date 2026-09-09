PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'building' CHECK(status IN ('building','awaiting_payment','payment_confirmed','cancelled','expired')),
  total_amount_cents INTEGER NOT NULL CHECK(total_amount_cents > 0),
  currency TEXT NOT NULL,
  item_count INTEGER NOT NULL CHECK(item_count > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  cancelled_at TEXT,
  UNIQUE (tenant_id, user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS academy_order_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK(product_type IN ('course','plan','event')),
  product_id TEXT NOT NULL,
  price_ref TEXT,
  description_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  unit_amount_cents INTEGER NOT NULL CHECK(unit_amount_cents > 0),
  total_amount_cents INTEGER NOT NULL CHECK(total_amount_cents > 0),
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK(total_amount_cents = unit_amount_cents * quantity),
  FOREIGN KEY (order_id) REFERENCES academy_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_order_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_payment_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('created','pending','approved','rejected','cancelled','refunded','chargeback')),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK(verification_status IN ('unverified','verified','rejected')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  verified_at TEXT,
  verification_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES academy_orders(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_orders_user
ON academy_orders(tenant_id,user_id,status,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_academy_order_items_order
ON academy_order_items(tenant_id,order_id,product_type);

CREATE INDEX IF NOT EXISTS idx_academy_order_payments_order
ON academy_order_payments(tenant_id,order_id,verification_status,status,observed_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_order_identity_update
BEFORE UPDATE ON academy_orders
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.user_id!=OLD.user_id OR NEW.idempotency_key!=OLD.idempotency_key
    THEN RAISE(ABORT,'order identity is immutable') END;
  SELECT CASE WHEN NEW.total_amount_cents!=OLD.total_amount_cents OR NEW.currency!=OLD.currency OR NEW.item_count!=OLD.item_count OR NEW.created_at!=OLD.created_at
    THEN RAISE(ABORT,'order monetary snapshot is immutable') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_order_status_transition
BEFORE UPDATE OF status ON academy_orders
WHEN NEW.status!=OLD.status
BEGIN
  SELECT CASE WHEN OLD.status='building' AND NEW.status NOT IN ('awaiting_payment','cancelled')
    THEN RAISE(ABORT,'invalid order status transition') END;
  SELECT CASE WHEN OLD.status='awaiting_payment' AND NEW.status NOT IN ('payment_confirmed','cancelled','expired')
    THEN RAISE(ABORT,'invalid order status transition') END;
  SELECT CASE WHEN OLD.status IN ('payment_confirmed','cancelled','expired')
    THEN RAISE(ABORT,'terminal order status cannot transition') END;
  SELECT CASE WHEN NEW.status='awaiting_payment' AND (
    (SELECT COUNT(*) FROM academy_order_items i WHERE i.tenant_id=NEW.tenant_id AND i.order_id=NEW.id)!=NEW.item_count OR
    COALESCE((SELECT SUM(i.total_amount_cents) FROM academy_order_items i WHERE i.tenant_id=NEW.tenant_id AND i.order_id=NEW.id),0)!=NEW.total_amount_cents
  ) THEN RAISE(ABORT,'order items do not match monetary snapshot') END;
  SELECT CASE WHEN NEW.status='payment_confirmed' AND NOT EXISTS (
    SELECT 1 FROM academy_order_payments p
    WHERE p.tenant_id=NEW.tenant_id AND p.order_id=NEW.id
      AND p.status='approved' AND p.verification_status='verified'
      AND p.amount_cents=NEW.total_amount_cents AND p.currency=NEW.currency
  ) THEN RAISE(ABORT,'payment confirmation requires verified approved payment') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_order_item_integrity_insert
BEFORE INSERT ON academy_order_items
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_orders o
    WHERE o.id=NEW.order_id AND o.tenant_id=NEW.tenant_id AND o.status='building'
  ) THEN RAISE(ABORT,'order item requires matching building order') END;

  SELECT CASE WHEN NEW.product_type='course' AND NOT EXISTS (
    SELECT 1 FROM academy_course_public_profiles p
    JOIN academy_courses c ON c.id=p.course_id AND c.tenant_id=p.tenant_id
    WHERE p.tenant_id=NEW.tenant_id AND p.course_id=NEW.product_id
      AND p.visibility='public' AND p.access_model='paid' AND c.status='published'
      AND p.list_price_cents=NEW.unit_amount_cents AND p.currency=NEW.currency
      AND NEW.price_ref IS NULL
  ) THEN RAISE(ABORT,'order course price/source mismatch') END;

  SELECT CASE WHEN NEW.product_type='plan' AND NOT EXISTS (
    SELECT 1 FROM academy_plan_prices pp
    JOIN academy_plans p ON p.id=pp.plan_id AND p.tenant_id=pp.tenant_id
    WHERE pp.tenant_id=NEW.tenant_id AND pp.plan_id=NEW.product_id AND pp.id=NEW.price_ref
      AND p.status='public' AND p.commercial_mode='priced' AND pp.status='active'
      AND pp.amount_cents=NEW.unit_amount_cents AND pp.currency=NEW.currency
      AND (pp.valid_from IS NULL OR datetime(pp.valid_from)<=datetime('now'))
      AND (pp.valid_until IS NULL OR datetime(pp.valid_until)>datetime('now'))
  ) THEN RAISE(ABORT,'order plan price/source mismatch') END;

  SELECT CASE WHEN NEW.product_type='event' AND NOT EXISTS (
    SELECT 1 FROM academy_events e
    WHERE e.tenant_id=NEW.tenant_id AND e.id=NEW.product_id
      AND e.status='published' AND e.access_model='paid'
      AND e.price_cents=NEW.unit_amount_cents AND e.currency=NEW.currency
      AND NEW.price_ref IS NULL
  ) THEN RAISE(ABORT,'order event price/source mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_order_item_immutable_update
BEFORE UPDATE ON academy_order_items
BEGIN
  SELECT RAISE(ABORT,'order item snapshot is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_order_payment_integrity_insert
BEFORE INSERT ON academy_order_payments
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_orders o WHERE o.id=NEW.order_id AND o.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'payment tenant/order mismatch') END;
  SELECT CASE WHEN NEW.verification_status='verified' AND (
    NEW.provider_payment_id IS NULL OR NEW.verified_at IS NULL OR NEW.verification_reference IS NULL
  ) THEN RAISE(ABORT,'verified payment requires provider id and verification evidence') END;
  SELECT CASE WHEN NEW.verification_status='verified' AND NEW.status='approved' AND NOT EXISTS (
    SELECT 1 FROM academy_orders o
    WHERE o.id=NEW.order_id AND o.tenant_id=NEW.tenant_id
      AND o.total_amount_cents=NEW.amount_cents AND o.currency=NEW.currency
  ) THEN RAISE(ABORT,'verified approved payment amount mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_order_payment_identity_update
BEFORE UPDATE ON academy_order_payments
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.order_id!=OLD.order_id OR NEW.provider!=OLD.provider OR NEW.created_at!=OLD.created_at
    THEN RAISE(ABORT,'payment identity is immutable') END;
  SELECT CASE WHEN OLD.verification_status='verified' AND (
    NEW.provider_payment_id IS NOT OLD.provider_payment_id OR NEW.status!=OLD.status OR NEW.verification_status!=OLD.verification_status OR
    NEW.amount_cents!=OLD.amount_cents OR NEW.currency!=OLD.currency OR NEW.verified_at IS NOT OLD.verified_at OR NEW.verification_reference IS NOT OLD.verification_reference
  ) THEN RAISE(ABORT,'verified payment snapshot is immutable') END;
  SELECT CASE WHEN NEW.verification_status='verified' AND (
    NEW.provider_payment_id IS NULL OR NEW.verified_at IS NULL OR NEW.verification_reference IS NULL
  ) THEN RAISE(ABORT,'verified payment requires provider id and verification evidence') END;
  SELECT CASE WHEN NEW.verification_status='verified' AND NEW.status='approved' AND NOT EXISTS (
    SELECT 1 FROM academy_orders o
    WHERE o.id=NEW.order_id AND o.tenant_id=NEW.tenant_id
      AND o.total_amount_cents=NEW.amount_cents AND o.currency=NEW.currency
  ) THEN RAISE(ABORT,'verified approved payment amount mismatch') END;
END;
