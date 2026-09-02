PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_instructors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name_snapshot TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS academy_instructor_qualifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  qualification_type TEXT NOT NULL CHECK(qualification_type IN ('degree','technical','council_registration','certification','experience','other')),
  title TEXT NOT NULL,
  institution TEXT,
  field TEXT,
  council_name TEXT,
  registration_number TEXT,
  registration_region TEXT,
  issued_at TEXT,
  expires_at TEXT,
  verification_status TEXT NOT NULL DEFAULT 'declared' CHECK(verification_status IN ('declared','verified','rejected','expired')),
  evidence_ref TEXT,
  declared_by TEXT NOT NULL,
  verified_by TEXT,
  verified_at TEXT,
  verification_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (instructor_id) REFERENCES academy_instructors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_instructor_specialties (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  specialty TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, instructor_id, specialty),
  FOREIGN KEY (instructor_id) REFERENCES academy_instructors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_course_instructor_roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('author','instructor','reviewer','technical_responsible')),
  qualification_id TEXT,
  suitability_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(suitability_confirmed IN (0,1)),
  suitability_confirmed_by TEXT,
  suitability_confirmed_at TEXT,
  suitability_note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  assigned_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE,
  FOREIGN KEY (instructor_id) REFERENCES academy_instructors(id) ON DELETE CASCADE,
  FOREIGN KEY (qualification_id) REFERENCES academy_instructor_qualifications(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_course_instructor_active_unique
ON academy_course_instructor_roles(tenant_id, course_id, instructor_id, role)
WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_academy_instructors_tenant
ON academy_instructors(tenant_id, status, display_name_snapshot);

CREATE INDEX IF NOT EXISTS idx_academy_qualifications_instructor
ON academy_instructor_qualifications(tenant_id, instructor_id, verification_status, expires_at);

CREATE INDEX IF NOT EXISTS idx_academy_course_roles_course
ON academy_course_instructor_roles(tenant_id, course_id, role, status);

CREATE TRIGGER IF NOT EXISTS trg_instructor_qualification_tenant_insert
BEFORE INSERT ON academy_instructor_qualifications
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_instructors i
    WHERE i.id=NEW.instructor_id AND i.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_instructor_qualifications tenant/instructor mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_instructor_qualification_tenant_update
BEFORE UPDATE ON academy_instructor_qualifications
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_instructors i
    WHERE i.id=NEW.instructor_id AND i.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_instructor_qualifications tenant/instructor mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_instructor_specialty_tenant_insert
BEFORE INSERT ON academy_instructor_specialties
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_instructors i
    WHERE i.id=NEW.instructor_id AND i.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_instructor_specialties tenant/instructor mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_course_instructor_role_tenant_insert
BEFORE INSERT ON academy_course_instructor_roles
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_instructor_roles tenant/course mismatch') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_instructors i
    WHERE i.id=NEW.instructor_id AND i.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_instructor_roles tenant/instructor mismatch') END;

  SELECT CASE WHEN NEW.qualification_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_instructor_qualifications q
    WHERE q.id=NEW.qualification_id AND q.instructor_id=NEW.instructor_id AND q.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_instructor_roles qualification mismatch') END;

  SELECT CASE WHEN NEW.role='technical_responsible' AND (
    NEW.qualification_id IS NULL OR NEW.suitability_confirmed!=1 OR NEW.suitability_confirmed_by IS NULL OR NEW.suitability_confirmed_at IS NULL
  ) THEN RAISE(ABORT, 'technical responsibility requires explicit suitability confirmation') END;

  SELECT CASE WHEN NEW.role='technical_responsible' AND NOT EXISTS (
    SELECT 1 FROM academy_instructor_qualifications q
    WHERE q.id=NEW.qualification_id
      AND q.instructor_id=NEW.instructor_id
      AND q.tenant_id=NEW.tenant_id
      AND q.verification_status='verified'
      AND (q.expires_at IS NULL OR datetime(q.expires_at) > datetime('now'))
  ) THEN RAISE(ABORT, 'technical responsibility requires verified current qualification') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_course_instructor_role_tenant_update
BEFORE UPDATE ON academy_course_instructor_roles
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_instructor_roles tenant/course mismatch') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_instructors i
    WHERE i.id=NEW.instructor_id AND i.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_instructor_roles tenant/instructor mismatch') END;

  SELECT CASE WHEN NEW.qualification_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_instructor_qualifications q
    WHERE q.id=NEW.qualification_id AND q.instructor_id=NEW.instructor_id AND q.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_instructor_roles qualification mismatch') END;
END;
