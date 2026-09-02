PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_enrollments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name_snapshot TEXT,
  source TEXT NOT NULL DEFAULT 'academy',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
  enrolled_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, course_id, student_id),
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_academy_enrollments_student
ON academy_enrollments(tenant_id, student_id, status, enrolled_at DESC);

CREATE INDEX IF NOT EXISTS idx_academy_enrollments_course
ON academy_enrollments(tenant_id, course_id, status, enrolled_at DESC);
