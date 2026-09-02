PRAGMA foreign_keys = ON;

ALTER TABLE academy_courses ADD COLUMN instructor_label TEXT;
ALTER TABLE academy_courses ADD COLUMN certificate_type TEXT NOT NULL DEFAULT 'free_course';

ALTER TABLE academy_certificates ADD COLUMN workload_minutes INTEGER;
ALTER TABLE academy_certificates ADD COLUMN instructor_label TEXT;
ALTER TABLE academy_certificates ADD COLUMN certificate_type TEXT NOT NULL DEFAULT 'free_course';
ALTER TABLE academy_certificates ADD COLUMN completion_date TEXT;
ALTER TABLE academy_certificates ADD COLUMN metadata_version INTEGER NOT NULL DEFAULT 1;

UPDATE academy_certificates
SET workload_minutes = COALESCE(
  workload_minutes,
  (SELECT SUM(l.duration_minutes)
   FROM academy_course_lessons l
   WHERE l.tenant_id=academy_certificates.tenant_id
     AND l.course_id=academy_certificates.course_id)
),
instructor_label = COALESCE(
  instructor_label,
  (SELECT c.instructor_label
   FROM academy_courses c
   WHERE c.tenant_id=academy_certificates.tenant_id
     AND c.id=academy_certificates.course_id)
),
completion_date = COALESCE(completion_date, issued_at);

CREATE INDEX IF NOT EXISTS idx_academy_certificates_public_status
ON academy_certificates(public_code, status);
