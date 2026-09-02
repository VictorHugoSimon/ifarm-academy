PRAGMA foreign_keys = ON;

-- Trilhas empresariais são específicas por tenant e empresa.
-- Nenhuma periodicidade regulatória é inferida automaticamente: renewal_months
-- deve ser configurado explicitamente pela operação responsável.
CREATE TABLE IF NOT EXISTS academy_company_learning_paths (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  default_renewal_months INTEGER CHECK(default_renewal_months IS NULL OR default_renewal_months > 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES academy_companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_company_learning_path_courses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
  required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)),
  renewal_months INTEGER CHECK(renewal_months IS NULL OR renewal_months > 0),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, path_id, course_id),
  FOREIGN KEY (company_id) REFERENCES academy_companies(id) ON DELETE CASCADE,
  FOREIGN KEY (path_id) REFERENCES academy_company_learning_paths(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_company_path_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','in_progress','completed','cancelled')),
  due_at TEXT,
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES academy_companies(id) ON DELETE CASCADE,
  FOREIGN KEY (path_id) REFERENCES academy_company_learning_paths(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES academy_company_members(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_company_path_assignment_open_unique
ON academy_company_path_assignments(tenant_id, company_id, path_id, member_id)
WHERE status IN ('assigned','in_progress');

CREATE TABLE IF NOT EXISTS academy_company_path_assignment_courses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  path_assignment_id TEXT NOT NULL,
  path_course_id TEXT NOT NULL,
  course_assignment_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, path_assignment_id, path_course_id),
  FOREIGN KEY (company_id) REFERENCES academy_companies(id) ON DELETE CASCADE,
  FOREIGN KEY (path_assignment_id) REFERENCES academy_company_path_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (path_course_id) REFERENCES academy_company_learning_path_courses(id) ON DELETE CASCADE,
  FOREIGN KEY (course_assignment_id) REFERENCES academy_course_assignments(id) ON DELETE CASCADE
);

-- Mantém histórico de ciclos concluídos e permite uma nova atribuição somente
-- quando não existe outra atribuição aberta para o mesmo curso/colaborador.
DROP INDEX IF EXISTS idx_academy_assignment_active_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_assignment_open_unique
ON academy_course_assignments(tenant_id, company_id, member_id, course_id)
WHERE status IN ('assigned','in_progress');

ALTER TABLE academy_course_assignments ADD COLUMN renewal_months INTEGER CHECK(renewal_months IS NULL OR renewal_months > 0);
ALTER TABLE academy_course_assignments ADD COLUMN renewal_of_assignment_id TEXT;
ALTER TABLE academy_course_assignments ADD COLUMN renewal_cycle INTEGER NOT NULL DEFAULT 1 CHECK(renewal_cycle > 0);

CREATE INDEX IF NOT EXISTS idx_academy_company_paths_company
ON academy_company_learning_paths(tenant_id, company_id, status, name);

CREATE INDEX IF NOT EXISTS idx_academy_path_courses_path
ON academy_company_learning_path_courses(tenant_id, path_id, position);

CREATE INDEX IF NOT EXISTS idx_academy_path_assignments_member
ON academy_company_path_assignments(tenant_id, company_id, member_id, status, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_academy_course_assignment_renewal
ON academy_course_assignments(tenant_id, company_id, renewal_months, completed_at);

CREATE TRIGGER IF NOT EXISTS trg_company_path_tenant_insert
BEFORE INSERT ON academy_company_learning_paths
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_companies c
    WHERE c.id=NEW.company_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_learning_paths tenant/company mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_company_path_course_tenant_insert
BEFORE INSERT ON academy_company_learning_path_courses
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_company_learning_paths p
    WHERE p.id=NEW.path_id AND p.company_id=NEW.company_id AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_learning_path_courses tenant/path mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_learning_path_courses tenant/course mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_company_path_assignment_tenant_insert
BEFORE INSERT ON academy_company_path_assignments
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_company_learning_paths p
    WHERE p.id=NEW.path_id AND p.company_id=NEW.company_id AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_path_assignments tenant/path mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_company_members m
    WHERE m.id=NEW.member_id AND m.company_id=NEW.company_id AND m.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_path_assignments tenant/member mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_company_path_assignment_course_tenant_insert
BEFORE INSERT ON academy_company_path_assignment_courses
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_company_path_assignments a
    WHERE a.id=NEW.path_assignment_id AND a.company_id=NEW.company_id AND a.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_path_assignment_courses tenant/assignment mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_company_learning_path_courses pc
    WHERE pc.id=NEW.path_course_id AND pc.company_id=NEW.company_id AND pc.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_path_assignment_courses tenant/path_course mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_course_assignments ca
    WHERE ca.id=NEW.course_assignment_id AND ca.company_id=NEW.company_id AND ca.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_company_path_assignment_courses tenant/course_assignment mismatch') END;
END;
