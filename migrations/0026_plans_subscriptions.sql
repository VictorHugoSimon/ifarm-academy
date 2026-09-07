PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  audience_type TEXT NOT NULL DEFAULT 'individual' CHECK(audience_type IN ('individual','corporate','partner')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','public','archived')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  contact_sales INTEGER NOT NULL DEFAULT 0 CHECK(contact_sales IN (0,1)),
  max_users INTEGER CHECK(max_users IS NULL OR max_users > 0),
  seo_title TEXT,
  seo_description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS academy_plan_prices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  billing_interval TEXT NOT NULL CHECK(billing_interval IN ('monthly','annual')),
  version INTEGER NOT NULL CHECK(version > 0),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','retired')),
  valid_from TEXT,
  valid_until TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, plan_id, billing_interval, version),
  FOREIGN KEY (plan_id) REFERENCES academy_plans(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_price_active_interval
ON academy_plan_prices(tenant_id,plan_id,billing_interval)
WHERE status='active';

CREATE TABLE IF NOT EXISTS academy_plan_courses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id,plan_id,course_id),
  FOREIGN KEY (plan_id) REFERENCES academy_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_plan_paths (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id,plan_id,path_id),
  FOREIGN KEY (plan_id) REFERENCES academy_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (path_id) REFERENCES academy_public_learning_paths(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  price_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment','active','past_due','cancelled','expired')),
  provider TEXT,
  provider_subscription_id TEXT,
  activation_reference TEXT,
  started_at TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES academy_plans(id) ON DELETE RESTRICT,
  FOREIGN KEY (price_id) REFERENCES academy_plan_prices(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_plans_public ON academy_plans(tenant_id,status,featured,name);
CREATE INDEX IF NOT EXISTS idx_plan_prices_plan ON academy_plan_prices(tenant_id,plan_id,billing_interval,status,version DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON academy_subscriptions(tenant_id,user_id,status,updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_plan_price_tenant_insert
BEFORE INSERT ON academy_plan_prices
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM academy_plans p WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'plan price tenant mismatch') END;
  SELECT CASE WHEN NEW.valid_until IS NOT NULL AND NEW.valid_from IS NOT NULL AND datetime(NEW.valid_until)<=datetime(NEW.valid_from)
    THEN RAISE(ABORT,'plan price validity window invalid') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_plan_course_tenant_insert
BEFORE INSERT ON academy_plan_courses
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM academy_plans p WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'plan course tenant/plan mismatch') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM academy_courses c WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'plan course tenant/course mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_plan_path_tenant_insert
BEFORE INSERT ON academy_plan_paths
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM academy_plans p WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'plan path tenant/plan mismatch') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM academy_public_learning_paths p WHERE p.id=NEW.path_id AND p.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'plan path tenant/path mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_plan_publish_update
BEFORE UPDATE ON academy_plans
WHEN NEW.status='public'
BEGIN
  SELECT CASE WHEN NEW.contact_sales=0 AND NOT EXISTS (
    SELECT 1 FROM academy_plan_prices pp
    WHERE pp.tenant_id=NEW.tenant_id AND pp.plan_id=NEW.id AND pp.status='active'
      AND (pp.valid_from IS NULL OR datetime(pp.valid_from)<=datetime('now'))
      AND (pp.valid_until IS NULL OR datetime(pp.valid_until)>datetime('now'))
  ) THEN RAISE(ABORT,'public plan requires active price or contact sales') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_plan_identity_update
BEFORE UPDATE ON academy_plans
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id THEN RAISE(ABORT,'plan identity is immutable') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_subscription_tenant_insert
BEFORE INSERT ON academy_subscriptions
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM academy_plans p WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'subscription tenant/plan mismatch') END;
  SELECT CASE WHEN NEW.price_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_plan_prices pp WHERE pp.id=NEW.price_id AND pp.plan_id=NEW.plan_id AND pp.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'subscription price mismatch') END;
  SELECT CASE WHEN NEW.status='active' AND (
    NEW.provider IS NULL OR NEW.provider_subscription_id IS NULL OR NEW.activation_reference IS NULL OR NEW.started_at IS NULL OR NEW.current_period_end IS NULL
  ) THEN RAISE(ABORT,'active subscription requires verified provider activation') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_subscription_activation_update
BEFORE UPDATE ON academy_subscriptions
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.user_id!=OLD.user_id OR NEW.plan_id!=OLD.plan_id
    THEN RAISE(ABORT,'subscription identity is immutable') END;
  SELECT CASE WHEN NEW.status='active' AND (
    NEW.provider IS NULL OR NEW.provider_subscription_id IS NULL OR NEW.activation_reference IS NULL OR NEW.started_at IS NULL OR NEW.current_period_end IS NULL
  ) THEN RAISE(ABORT,'active subscription requires verified provider activation') END;
END;
