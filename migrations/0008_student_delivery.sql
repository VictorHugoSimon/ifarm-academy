PRAGMA foreign_keys = ON;

ALTER TABLE academy_progress ADD COLUMN last_position_seconds INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_academy_progress_tenant_course_student
ON academy_progress(tenant_id, course_id, student_id, progress_percent);
