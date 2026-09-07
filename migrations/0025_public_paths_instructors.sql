PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_instructor_public_profiles (
  instructor_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'hidden' CHECK(visibility IN ('hidden','public')),
  headline TEXT,
  short_bio TEXT,
  photo_ref TEXT,
  public_specialties_json TEXT NOT NULL DEFAULT '[]',
  credential_summary TEXT,
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  seo_title TEXT,
  seo_description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, slug),
  FOREIGN KEY (instructor_id) REFERENCES academy_instructors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_public_learning_paths (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT NOT NULL DEFAULT '',
  category TEXT,
  cover_ref TEXT,
  visibility TEXT NOT NULL DEFAULT 'hidden' CHECK(visibility IN ('hidden','public')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  access_model TEXT NOT NULL DEFAULT 'not_configured' CHECK(access_model IN ('not_configured','free','paid','sponsored','included')),
  list_price_cents INTEGER CHECK(list_price_cents IS NULL OR list_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  seo_title TEXT,
  seo_description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS academy_public_learning_path_courses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, path_id, course_id),
  UNIQUE (tenant_id, path_id, position),
  FOREIGN KEY (path_id) REFERENCES academy_public_learning_paths(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_instructor_public_profiles_listing
ON academy_instructor_public_profiles(tenant_id, visibility, featured, slug);

CREATE INDEX IF NOT EXISTS idx_public_learning_paths_listing
ON academy_public_learning_paths(tenant_id, visibility, featured, title);

CREATE INDEX IF NOT EXISTS idx_public_learning_path_courses_order
ON academy_public_learning_path_courses(tenant_id, path_id, position);

CREATE TRIGGER IF NOT EXISTS trg_instructor_public_profile_insert
BEFORE INSERT ON academy_instructor_public_profiles
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_instructors i
    WHERE i.id=NEW.instructor_id AND i.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'instructor public profile tenant mismatch') END;
  SELECT CASE WHEN NEW.visibility='public' AND NOT EXISTS (
    SELECT 1 FROM academy_instructors i
    WHERE i.id=NEW.instructor_id AND i.tenant_id=NEW.tenant_id AND i.status='active'
  ) THEN RAISE(ABORT, 'public instructor profile requires active instructor') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_instructor_public_profile_update
BEFORE UPDATE ON academy_instructor_public_profiles
BEGIN
  SELECT CASE WHEN NEW.instructor_id!=OLD.instructor_id OR NEW.tenant_id!=OLD.tenant_id
    THEN RAISE(ABORT, 'instructor public profile identity is immutable') END;
  SELECT CASE WHEN NEW.visibility='public' AND NOT EXISTS (
    SELECT 1 FROM academy_instructors i
    WHERE i.id=NEW.instructor_id AND i.tenant_id=NEW.tenant_id AND i.status='active'
  ) THEN RAISE(ABORT, 'public instructor profile requires active instructor') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_public_path_access_insert
BEFORE INSERT ON academy_public_learning_paths
BEGIN
  SELECT CASE WHEN NEW.access_model='paid' AND (NEW.list_price_cents IS NULL OR NEW.list_price_cents < 1)
    THEN RAISE(ABORT, 'paid public path requires price') END;
  SELECT CASE WHEN NEW.access_model!='paid' AND NEW.list_price_cents IS NOT NULL AND NEW.list_price_cents > 0
    THEN RAISE(ABORT, 'only paid public path accepts positive price') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_public_path_access_update
BEFORE UPDATE ON academy_public_learning_paths
BEGIN
  SELECT CASE WHEN NEW.tenant_id!=OLD.tenant_id OR NEW.id!=OLD.id
    THEN RAISE(ABORT, 'public learning path identity is immutable') END;
  SELECT CASE WHEN NEW.access_model='paid' AND (NEW.list_price_cents IS NULL OR NEW.list_price_cents < 1)
    THEN RAISE(ABORT, 'paid public path requires price') END;
  SELECT CASE WHEN NEW.access_model!='paid' AND NEW.list_price_cents IS NOT NULL AND NEW.list_price_cents > 0
    THEN RAISE(ABORT, 'only paid public path accepts positive price') END;
  SELECT CASE WHEN NEW.visibility='public' AND NOT EXISTS (
    SELECT 1 FROM academy_public_learning_path_courses pc
    JOIN academy_courses c ON c.id=pc.course_id AND c.tenant_id=pc.tenant_id AND c.status='published'
    JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
    WHERE pc.path_id=NEW.id AND pc.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'public learning path requires at least one public course') END;
  SELECT CASE WHEN NEW.visibility='public' AND EXISTS (
    SELECT 1 FROM academy_public_learning_path_courses pc
    LEFT JOIN academy_courses c ON c.id=pc.course_id AND c.tenant_id=pc.tenant_id AND c.status='published'
    LEFT JOIN academy_course_public_profiles cp ON cp.course_id=pc.course_id AND cp.tenant_id=pc.tenant_id AND cp.visibility='public'
    WHERE pc.path_id=NEW.id AND pc.tenant_id=NEW.tenant_id
      AND (c.id IS NULL OR cp.course_id IS NULL)
  ) THEN RAISE(ABORT, 'public learning path contains non-public course') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_public_path_course_insert
BEFORE INSERT ON academy_public_learning_path_courses
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_public_learning_paths p
    WHERE p.id=NEW.path_id AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'public path course tenant/path mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'public path course tenant/course mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_public_path_course_update
BEFORE UPDATE ON academy_public_learning_path_courses
BEGIN
  SELECT CASE WHEN NEW.tenant_id!=OLD.tenant_id OR NEW.path_id!=OLD.path_id OR NEW.course_id!=OLD.course_id
    THEN RAISE(ABORT, 'public path course identity is immutable') END;
END;
