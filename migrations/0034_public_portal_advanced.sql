PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_public_partner_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_system TEXT NOT NULL CHECK(source_system IN ('ifarm_core','ifarm_store','ifarm_services','ifarm_finance','ifarm_insurance','marketplace','partner','other')),
  source_ref TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  short_description TEXT,
  description TEXT NOT NULL DEFAULT '',
  logo_ref TEXT,
  website_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'hidden' CHECK(visibility IN ('hidden','public')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  seo_title TEXT,
  seo_description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, slug),
  UNIQUE (tenant_id, source_system, source_ref)
);

CREATE TABLE IF NOT EXISTS academy_public_bundles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT NOT NULL DEFAULT '',
  cover_ref TEXT,
  category TEXT,
  visibility TEXT NOT NULL DEFAULT 'hidden' CHECK(visibility IN ('hidden','public')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  seo_title TEXT,
  seo_description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS academy_public_bundle_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('course','path','plan','partner','external_reference')),
  item_ref TEXT NOT NULL,
  source_system TEXT,
  label TEXT,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL CHECK(position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id,bundle_id,position),
  UNIQUE (tenant_id,bundle_id,item_type,item_ref),
  FOREIGN KEY (bundle_id) REFERENCES academy_public_bundles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_public_partners_listing
ON academy_public_partner_profiles(tenant_id,visibility,featured,display_name);

CREATE INDEX IF NOT EXISTS idx_public_bundles_listing
ON academy_public_bundles(tenant_id,visibility,featured,title);

CREATE INDEX IF NOT EXISTS idx_public_bundle_items_order
ON academy_public_bundle_items(tenant_id,bundle_id,position);

CREATE TRIGGER IF NOT EXISTS trg_public_partner_identity_update
BEFORE UPDATE ON academy_public_partner_profiles
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.source_system!=OLD.source_system OR NEW.source_ref!=OLD.source_ref
    THEN RAISE(ABORT,'public partner identity/source is immutable') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_public_bundle_identity_update
BEFORE UPDATE ON academy_public_bundles
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id
    THEN RAISE(ABORT,'public bundle identity is immutable') END;
  SELECT CASE WHEN NEW.visibility='public' AND NOT EXISTS (
    SELECT 1 FROM academy_public_bundle_items bi
    WHERE bi.tenant_id=NEW.tenant_id AND bi.bundle_id=NEW.id
  ) THEN RAISE(ABORT,'public bundle requires at least one item') END;
  SELECT CASE WHEN NEW.visibility='public' AND EXISTS (
    SELECT 1 FROM academy_public_bundle_items bi
    WHERE bi.tenant_id=NEW.tenant_id AND bi.bundle_id=NEW.id
      AND bi.item_type='course'
      AND NOT EXISTS (
        SELECT 1 FROM academy_courses c
        JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
        WHERE c.id=bi.item_ref AND c.tenant_id=bi.tenant_id AND c.status='published'
      )
  ) THEN RAISE(ABORT,'public bundle contains non-public course') END;
  SELECT CASE WHEN NEW.visibility='public' AND EXISTS (
    SELECT 1 FROM academy_public_bundle_items bi
    WHERE bi.tenant_id=NEW.tenant_id AND bi.bundle_id=NEW.id AND bi.item_type='path'
      AND NOT EXISTS (SELECT 1 FROM academy_public_learning_paths p WHERE p.id=bi.item_ref AND p.tenant_id=bi.tenant_id AND p.visibility='public')
  ) THEN RAISE(ABORT,'public bundle contains non-public path') END;
  SELECT CASE WHEN NEW.visibility='public' AND EXISTS (
    SELECT 1 FROM academy_public_bundle_items bi
    WHERE bi.tenant_id=NEW.tenant_id AND bi.bundle_id=NEW.id AND bi.item_type='plan'
      AND NOT EXISTS (SELECT 1 FROM academy_plans p WHERE p.id=bi.item_ref AND p.tenant_id=bi.tenant_id AND p.status='public')
  ) THEN RAISE(ABORT,'public bundle contains non-public plan') END;
  SELECT CASE WHEN NEW.visibility='public' AND EXISTS (
    SELECT 1 FROM academy_public_bundle_items bi
    WHERE bi.tenant_id=NEW.tenant_id AND bi.bundle_id=NEW.id AND bi.item_type='partner'
      AND NOT EXISTS (SELECT 1 FROM academy_public_partner_profiles p WHERE p.id=bi.item_ref AND p.tenant_id=bi.tenant_id AND p.visibility='public')
  ) THEN RAISE(ABORT,'public bundle contains non-public partner') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_public_bundle_item_insert
BEFORE INSERT ON academy_public_bundle_items
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_public_bundles b WHERE b.id=NEW.bundle_id AND b.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'public bundle item tenant/bundle mismatch') END;
  SELECT CASE WHEN NEW.item_type='course' AND NOT EXISTS (
    SELECT 1 FROM academy_courses c WHERE c.id=NEW.item_ref AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'public bundle course tenant mismatch') END;
  SELECT CASE WHEN NEW.item_type='path' AND NOT EXISTS (
    SELECT 1 FROM academy_public_learning_paths p WHERE p.id=NEW.item_ref AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'public bundle path tenant mismatch') END;
  SELECT CASE WHEN NEW.item_type='plan' AND NOT EXISTS (
    SELECT 1 FROM academy_plans p WHERE p.id=NEW.item_ref AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'public bundle plan tenant mismatch') END;
  SELECT CASE WHEN NEW.item_type='partner' AND NOT EXISTS (
    SELECT 1 FROM academy_public_partner_profiles p WHERE p.id=NEW.item_ref AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT,'public bundle partner tenant mismatch') END;
  SELECT CASE WHEN NEW.item_type='external_reference' AND (NEW.source_system IS NULL OR TRIM(NEW.source_system)='' OR NEW.label IS NULL OR TRIM(NEW.label)='')
    THEN RAISE(ABORT,'external bundle reference requires source system and label') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_public_bundle_item_identity_update
BEFORE UPDATE ON academy_public_bundle_items
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.bundle_id!=OLD.bundle_id OR NEW.item_type!=OLD.item_type OR NEW.item_ref!=OLD.item_ref
    THEN RAISE(ABORT,'public bundle item identity is immutable') END;
END;
