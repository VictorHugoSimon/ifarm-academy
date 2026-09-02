PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_companies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  document_label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_company_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name_snapshot TEXT NOT NULL,
  employee_code TEXT,
  job_title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, company_id, user_id),
  FOREIGN KEY (company_id) REFERENCES academy_companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_course_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)),
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','in_progress','completed','cancelled')),
  source TEXT NOT NULL DEFAULT 'company_admin',
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES academy_companies(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES academy_company_members(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_assignment_active_unique
ON academy_course_assignments(tenant_id, company_id, member_id, course_id)
WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_academy_companies_tenant
ON academy_companies(tenant_id, status, name);

CREATE INDEX IF NOT EXISTS idx_academy_company_members_company
ON academy_company_members(tenant_id, company_id, status, display_name_snapshot);

CREATE INDEX IF NOT EXISTS idx_academy_assignments_company
ON academy_course_assignments(tenant_id, company_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_academy_assignments_member
ON academy_course_assignments(tenant_id, member_id, status, assigned_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_company_member_tenant_insert
BEFORE INSERT ON academy_company_members
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_companies c
    WHERE c.id=NEW.company_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_members tenant/company mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_company_member_tenant_update
BEFORE UPDATE ON academy_company_members
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_companies c
    WHERE c.id=NEW.company_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_members tenant/company mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_assignment_tenant_insert
BEFORE INSERT ON academy_course_assignments
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_companies c
    WHERE c.id=NEW.company_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_assignments tenant/company mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_company_members m
    WHERE m.id=NEW.member_id AND m.company_id=NEW.company_id AND m.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_assignments tenant/member mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_assignments tenant/course mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_assignment_tenant_update
BEFORE UPDATE ON academy_course_assignments
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_companies c
    WHERE c.id=NEW.company_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_assignments tenant/company mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_company_members m
    WHERE m.id=NEW.member_id AND m.company_id=NEW.company_id AND m.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_assignments tenant/member mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_course_assignments tenant/course mismatch') END;
END;
