PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_course_public_profiles (
  course_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT,
  level_label TEXT,
  short_description TEXT,
  audience_text TEXT,
  cover_ref TEXT,
  visibility TEXT NOT NULL DEFAULT 'hidden' CHECK(visibility IN ('hidden','public')),
  access_model TEXT NOT NULL DEFAULT 'not_configured' CHECK(access_model IN ('not_configured','free','paid','sponsored','included')),
  list_price_cents INTEGER CHECK(list_price_cents IS NULL OR list_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  seo_title TEXT,
  seo_description TEXT,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, slug),
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE,
  CHECK(access_model='paid' OR list_price_cents IS NULL OR list_price_cents=0),
  CHECK(access_model!='paid' OR (list_price_cents IS NOT NULL AND list_price_cents > 0))
);

CREATE INDEX IF NOT EXISTS idx_course_public_profiles_catalog
ON academy_course_public_profiles(tenant_id, visibility, featured, category, updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_course_public_profile_tenant_insert
BEFORE INSERT ON academy_course_public_profiles
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'public course profile tenant/course mismatch') END;
  SELECT CASE WHEN NEW.visibility='public' AND NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id AND c.status='published'
  ) THEN RAISE(ABORT, 'public course profile requires published academic course') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_course_public_profile_tenant_update
BEFORE UPDATE ON academy_course_public_profiles
BEGIN
  SELECT CASE WHEN NEW.course_id!=OLD.course_id OR NEW.tenant_id!=OLD.tenant_id
    THEN RAISE(ABORT, 'public course profile identity is immutable') END;
  SELECT CASE WHEN NEW.visibility='public' AND NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id AND c.status='published'
  ) THEN RAISE(ABORT, 'public course profile requires published academic course') END;
END;
