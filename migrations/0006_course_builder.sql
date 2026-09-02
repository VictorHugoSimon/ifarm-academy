PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_courses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published','archived')),
  quiz_enabled INTEGER NOT NULL DEFAULT 0 CHECK(quiz_enabled IN (0,1)),
  minimum_score REAL NOT NULL DEFAULT 0 CHECK(minimum_score BETWEEN 0 AND 100),
  attempts_allowed INTEGER NOT NULL DEFAULT 1 CHECK(attempts_allowed > 0),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_course_modules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_course_lessons (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK(duration_minutes >= 0),
  required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)),
  position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
  content_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES academy_course_modules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_academy_courses_tenant
ON academy_courses(tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_academy_modules_course
ON academy_course_modules(tenant_id, course_id, position);

CREATE INDEX IF NOT EXISTS idx_academy_lessons_course
ON academy_course_lessons(tenant_id, course_id, module_id, position);
