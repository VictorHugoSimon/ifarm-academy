PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_white_label_settings (
  tenant_id TEXT PRIMARY KEY,
  brand_name TEXT NOT NULL,
  academy_name TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  logo_ref TEXT,
  certificate_heading TEXT,
  catalog_mode TEXT NOT NULL DEFAULT 'all_tenant_courses' CHECK(catalog_mode IN ('all_tenant_courses','selected_courses')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_white_label_domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hostname TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','disabled')),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
  verification_reference TEXT,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  verified_by TEXT,
  verified_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_white_label_primary_domain
ON academy_white_label_domains(tenant_id)
WHERE status='verified' AND is_primary=1;

CREATE INDEX IF NOT EXISTS idx_white_label_domains_tenant
ON academy_white_label_domains(tenant_id, status, hostname);

CREATE TABLE IF NOT EXISTS academy_white_label_catalog_courses (
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0,1)),
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, course_id),
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS trg_white_label_domain_verify_insert
BEFORE INSERT ON academy_white_label_domains
BEGIN
  SELECT CASE WHEN NEW.status='verified' AND (NEW.verified_by IS NULL OR NEW.verified_at IS NULL OR NEW.verification_reference IS NULL)
  THEN RAISE(ABORT, 'verified white-label domain requires verifier and reference') END;
  SELECT CASE WHEN NEW.is_primary=1 AND NEW.status!='verified'
  THEN RAISE(ABORT, 'primary white-label domain must be verified') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_white_label_domain_verify_update
BEFORE UPDATE ON academy_white_label_domains
BEGIN
  SELECT CASE WHEN NEW.hostname != OLD.hostname OR NEW.tenant_id != OLD.tenant_id
  THEN RAISE(ABORT, 'white-label domain identity is immutable') END;
  SELECT CASE WHEN NEW.status='verified' AND (NEW.verified_by IS NULL OR NEW.verified_at IS NULL OR NEW.verification_reference IS NULL)
  THEN RAISE(ABORT, 'verified white-label domain requires verifier and reference') END;
  SELECT CASE WHEN NEW.is_primary=1 AND NEW.status!='verified'
  THEN RAISE(ABORT, 'primary white-label domain must be verified') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_white_label_catalog_course_insert
BEFORE INSERT ON academy_white_label_catalog_courses
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'white-label catalog tenant/course mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_white_label_catalog_course_update
BEFORE UPDATE ON academy_white_label_catalog_courses
BEGIN
  SELECT CASE WHEN NEW.tenant_id != OLD.tenant_id OR NEW.course_id != OLD.course_id
  THEN RAISE(ABORT, 'white-label catalog identity is immutable') END;
END;

ALTER TABLE academy_certificates ADD COLUMN brand_snapshot_json TEXT;
