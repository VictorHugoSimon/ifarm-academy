PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_tutor_course_policies (
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  approved_by TEXT,
  approved_at TEXT,
  disabled_at TEXT,
  last_indexed_at TEXT,
  last_indexed_course_updated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(tenant_id, course_id),
  FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE,
  CHECK(enabled = 0 OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_tutor_policy_enabled
ON academy_tutor_course_policies(tenant_id, enabled, updated_at DESC);

-- v0.56 tratava curso publicado como autorização implícita. A partir daqui,
-- a política precisa ser aprovada explicitamente; índices antigos são descartados.
DELETE FROM academy_tutor_source_chunks;

CREATE TRIGGER IF NOT EXISTS trg_tutor_policy_scope_insert
BEFORE INSERT ON academy_tutor_course_policies
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'tutor_policy_invalid_course') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_policy_scope_update
BEFORE UPDATE OF tenant_id, course_id ON academy_tutor_course_policies
BEGIN
  SELECT RAISE(ABORT, 'tutor_policy_identity_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_chunk_policy_guard_insert
BEFORE INSERT ON academy_tutor_source_chunks
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM academy_tutor_course_policies p
    JOIN academy_courses c ON c.id=p.course_id AND c.tenant_id=p.tenant_id
    WHERE p.tenant_id=NEW.tenant_id
      AND p.course_id=NEW.course_id
      AND p.enabled=1
      AND c.status='published'
  ) THEN RAISE(ABORT, 'tutor_content_not_authorized') END;
END;
