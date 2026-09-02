PRAGMA foreign_keys = ON;

DROP INDEX IF EXISTS idx_academy_assignment_active_unique;

ALTER TABLE academy_course_assignments ADD COLUMN renewal_interval_days INTEGER CHECK(renewal_interval_days IS NULL OR renewal_interval_days > 0);
ALTER TABLE academy_course_assignments ADD COLUMN next_due_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_assignment_active_unique
ON academy_course_assignments(tenant_id, company_id, member_id, course_id)
WHERE status IN ('assigned','in_progress');

CREATE INDEX IF NOT EXISTS idx_academy_assignment_renewal
ON academy_course_assignments(tenant_id, company_id, next_due_at)
WHERE next_due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS academy_learning_paths (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_learning_path_courses (
  tenant_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
  required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)),
  due_offset_days INTEGER CHECK(due_offset_days IS NULL OR due_offset_days >= 0),
  renewal_interval_days INTEGER CHECK(renewal_interval_days IS NULL OR renewal_interval_days > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, path_id, course_id),
  FOREIGN KEY (path_id) REFERENCES academy_learning_paths(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_company_path_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  due_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES academy_companies(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES academy_company_members(id) ON DELETE CASCADE,
  FOREIGN KEY (path_id) REFERENCES academy_learning_paths(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_company_path_active_unique
ON academy_company_path_assignments(tenant_id, company_id, member_id, path_id)
WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_academy_paths_tenant_status
ON academy_learning_paths(tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_academy_path_courses_order
ON academy_learning_path_courses(tenant_id, path_id, position);

CREATE INDEX IF NOT EXISTS idx_academy_company_paths_company
ON academy_company_path_assignments(tenant_id, company_id, status, assigned_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_path_course_tenant_insert
BEFORE INSERT ON academy_learning_path_courses
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_learning_paths p WHERE p.id=NEW.path_id AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_learning_path_courses tenant/path mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_learning_path_courses tenant/course mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_path_course_tenant_update
BEFORE UPDATE ON academy_learning_path_courses
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_learning_paths p WHERE p.id=NEW.path_id AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_learning_path_courses tenant/path mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_learning_path_courses tenant/course mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_company_path_tenant_insert
BEFORE INSERT ON academy_company_path_assignments
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_companies c WHERE c.id=NEW.company_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_path_assignments tenant/company mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_company_members m WHERE m.id=NEW.member_id AND m.company_id=NEW.company_id AND m.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_path_assignments tenant/member mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_learning_paths p WHERE p.id=NEW.path_id AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_path_assignments tenant/path mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_company_path_tenant_update
BEFORE UPDATE ON academy_company_path_assignments
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_companies c WHERE c.id=NEW.company_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_path_assignments tenant/company mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_company_members m WHERE m.id=NEW.member_id AND m.company_id=NEW.company_id AND m.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_path_assignments tenant/member mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_learning_paths p WHERE p.id=NEW.path_id AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_path_assignments tenant/path mismatch') END;
END;
