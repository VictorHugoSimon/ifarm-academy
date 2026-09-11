-- iFarm Academy v0.63 — parceiros públicos e bundles por referência.
-- Parceiro é projeção pública referenciada; não substitui cadastro mestre do iFarm Core/CRM.

CREATE TABLE academy_public_partners (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  partner_type TEXT NOT NULL DEFAULT 'technology' CHECK (partner_type IN ('technology','education','financial','insurance','retail','service','sponsor','other')),
  source_system TEXT NOT NULL,
  external_ref TEXT NOT NULL,
  logo_ref TEXT,
  website_url TEXT,
  status TEXT NOT NULL DEFAULT 'hidden' CHECK (status IN ('hidden','public')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  created_by TEXT NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, slug),
  UNIQUE (tenant_id, source_system, external_ref)
);

CREATE INDEX idx_academy_public_partners_tenant_status
  ON academy_public_partners(tenant_id, status, featured, display_name);

CREATE TABLE academy_public_bundles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'hidden' CHECK (status IN ('hidden','public')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  commercial_mode TEXT NOT NULL DEFAULT 'contact_sales' CHECK (commercial_mode IN ('free','priced','contact_sales')),
  list_price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'BRL',
  cover_ref TEXT,
  seo_title TEXT,
  seo_description TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (commercial_mode='priced' AND list_price_cents IS NOT NULL AND list_price_cents > 0)
    OR (commercial_mode IN ('free','contact_sales') AND list_price_cents IS NULL)
  ),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_academy_public_bundles_tenant_status
  ON academy_public_bundles(tenant_id, status, featured, title);

CREATE TABLE academy_public_bundle_courses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL REFERENCES academy_public_bundles(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES academy_courses(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, bundle_id, course_id)
);

CREATE TABLE academy_public_bundle_paths (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL REFERENCES academy_public_bundles(id) ON DELETE CASCADE,
  path_id TEXT NOT NULL REFERENCES academy_public_learning_paths(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, bundle_id, path_id)
);

CREATE TABLE academy_public_bundle_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL REFERENCES academy_public_bundles(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES academy_plans(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, bundle_id, plan_id)
);

CREATE TABLE academy_public_bundle_external_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL REFERENCES academy_public_bundles(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  external_ref TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  item_type TEXT NOT NULL DEFAULT 'service' CHECK (item_type IN ('product','service','finance','insurance','consulting','event','other')),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, bundle_id, source_system, external_ref)
);

CREATE TABLE academy_public_bundle_partners (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL REFERENCES academy_public_bundles(id) ON DELETE CASCADE,
  partner_id TEXT NOT NULL REFERENCES academy_public_partners(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, bundle_id, partner_id)
);

CREATE TRIGGER trg_public_bundle_course_tenant_insert
BEFORE INSERT ON academy_public_bundle_courses
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_public_bundles b JOIN academy_courses c
      ON c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
    WHERE b.id=NEW.bundle_id AND b.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'academy_public_bundle_courses tenant mismatch') END;
END;

CREATE TRIGGER trg_public_bundle_path_tenant_insert
BEFORE INSERT ON academy_public_bundle_paths
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_public_bundles b JOIN academy_public_learning_paths p
      ON p.id=NEW.path_id AND p.tenant_id=NEW.tenant_id
    WHERE b.id=NEW.bundle_id AND b.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'academy_public_bundle_paths tenant mismatch') END;
END;

CREATE TRIGGER trg_public_bundle_plan_tenant_insert
BEFORE INSERT ON academy_public_bundle_plans
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_public_bundles b JOIN academy_plans p
      ON p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id
    WHERE b.id=NEW.bundle_id AND b.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'academy_public_bundle_plans tenant mismatch') END;
END;

CREATE TRIGGER trg_public_bundle_external_tenant_insert
BEFORE INSERT ON academy_public_bundle_external_items
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_public_bundles b WHERE b.id=NEW.bundle_id AND b.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'academy_public_bundle_external_items tenant mismatch') END;
END;

CREATE TRIGGER trg_public_bundle_partner_tenant_insert
BEFORE INSERT ON academy_public_bundle_partners
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_public_bundles b JOIN academy_public_partners p
      ON p.id=NEW.partner_id AND p.tenant_id=NEW.tenant_id
    WHERE b.id=NEW.bundle_id AND b.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'academy_public_bundle_partners tenant mismatch') END;
END;

CREATE TRIGGER trg_public_bundle_publish_guard
BEFORE UPDATE OF status ON academy_public_bundles
WHEN NEW.status='public'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_public_bundle_courses x WHERE x.tenant_id=NEW.tenant_id AND x.bundle_id=NEW.id
    UNION ALL SELECT 1 FROM academy_public_bundle_paths x WHERE x.tenant_id=NEW.tenant_id AND x.bundle_id=NEW.id
    UNION ALL SELECT 1 FROM academy_public_bundle_plans x WHERE x.tenant_id=NEW.tenant_id AND x.bundle_id=NEW.id
    UNION ALL SELECT 1 FROM academy_public_bundle_external_items x WHERE x.tenant_id=NEW.tenant_id AND x.bundle_id=NEW.id
  ) THEN RAISE(ABORT,'public bundle requires at least one item') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM academy_public_bundle_courses x
    LEFT JOIN academy_courses c ON c.id=x.course_id AND c.tenant_id=x.tenant_id AND c.status='published'
    LEFT JOIN academy_course_public_profiles cp ON cp.course_id=x.course_id AND cp.tenant_id=x.tenant_id AND cp.visibility='public'
    WHERE x.tenant_id=NEW.tenant_id AND x.bundle_id=NEW.id AND (c.id IS NULL OR cp.course_id IS NULL)
  ) THEN RAISE(ABORT,'public bundle contains non-public course') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM academy_public_bundle_paths x
    LEFT JOIN academy_public_learning_paths p ON p.id=x.path_id AND p.tenant_id=x.tenant_id AND p.visibility='public'
    WHERE x.tenant_id=NEW.tenant_id AND x.bundle_id=NEW.id AND p.id IS NULL
  ) THEN RAISE(ABORT,'public bundle contains non-public path') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM academy_public_bundle_plans x
    LEFT JOIN academy_plans p ON p.id=x.plan_id AND p.tenant_id=x.tenant_id AND p.status='public'
    WHERE x.tenant_id=NEW.tenant_id AND x.bundle_id=NEW.id AND p.id IS NULL
  ) THEN RAISE(ABORT,'public bundle contains non-public plan') END;
END;

CREATE TRIGGER trg_public_bundle_identity_immutable
BEFORE UPDATE OF tenant_id ON academy_public_bundles
WHEN NEW.tenant_id <> OLD.tenant_id
BEGIN SELECT RAISE(ABORT,'bundle tenant is immutable'); END;

CREATE TRIGGER trg_public_partner_identity_immutable
BEFORE UPDATE OF tenant_id,source_system,external_ref ON academy_public_partners
WHEN NEW.tenant_id <> OLD.tenant_id OR NEW.source_system <> OLD.source_system OR NEW.external_ref <> OLD.external_ref
BEGIN SELECT RAISE(ABORT,'partner reference identity is immutable'); END;
