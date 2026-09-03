PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_certificate_validity_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  validity_mode TEXT NOT NULL CHECK(validity_mode IN ('indefinite','fixed_months')),
  validity_months INTEGER CHECK(validity_months IS NULL OR (validity_months >= 1 AND validity_months <= 1200)),
  source_reference TEXT NOT NULL,
  note TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version > 0),
  confirmed_by TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, course_id),
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_certificate_validity_policy_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version > 0),
  validity_mode TEXT NOT NULL CHECK(validity_mode IN ('indefinite','fixed_months')),
  validity_months INTEGER CHECK(validity_months IS NULL OR (validity_months >= 1 AND validity_months <= 1200)),
  source_reference TEXT NOT NULL,
  note TEXT NOT NULL,
  confirmed_by TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, course_id, version),
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_academy_certificate_validity_policy_course
ON academy_certificate_validity_policies(tenant_id, course_id, version);

CREATE INDEX IF NOT EXISTS idx_academy_certificate_validity_history
ON academy_certificate_validity_policy_versions(tenant_id, course_id, version DESC);

CREATE TRIGGER IF NOT EXISTS trg_certificate_validity_policy_insert
BEFORE INSERT ON academy_certificate_validity_policies
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_certificate_validity_policies tenant/course mismatch') END;

  SELECT CASE WHEN NEW.validity_mode='fixed_months' AND NEW.validity_months IS NULL
    THEN RAISE(ABORT, 'fixed_months requires validity_months') END;
  SELECT CASE WHEN NEW.validity_mode='indefinite' AND NEW.validity_months IS NOT NULL
    THEN RAISE(ABORT, 'indefinite validity must not define validity_months') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_certificate_validity_policy_update
BEFORE UPDATE ON academy_certificate_validity_policies
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_certificate_validity_policies tenant/course mismatch') END;

  SELECT CASE WHEN NEW.validity_mode='fixed_months' AND NEW.validity_months IS NULL
    THEN RAISE(ABORT, 'fixed_months requires validity_months') END;
  SELECT CASE WHEN NEW.validity_mode='indefinite' AND NEW.validity_months IS NOT NULL
    THEN RAISE(ABORT, 'indefinite validity must not define validity_months') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_certificate_validity_history_insert
BEFORE INSERT ON academy_certificate_validity_policy_versions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_certificate_validity_policy_versions tenant/course mismatch') END;
END;

ALTER TABLE academy_certificates ADD COLUMN validity_mode TEXT NOT NULL DEFAULT 'not_configured'
  CHECK(validity_mode IN ('not_configured','indefinite','fixed_months'));
ALTER TABLE academy_certificates ADD COLUMN validity_policy_version INTEGER;
ALTER TABLE academy_certificates ADD COLUMN valid_until TEXT;
ALTER TABLE academy_certificates ADD COLUMN validity_policy_snapshot_json TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_academy_certificates_valid_until
ON academy_certificates(tenant_id, certificate_type, status, valid_until);

PRAGMA foreign_keys = ON;
