PRAGMA foreign_keys = ON;

ALTER TABLE academy_progress ADD COLUMN tenant_id TEXT;
ALTER TABLE academy_quiz_attempts ADD COLUMN tenant_id TEXT;
ALTER TABLE academy_quiz_attempts ADD COLUMN student_name_snapshot TEXT;
ALTER TABLE academy_certificates ADD COLUMN tenant_id TEXT;
ALTER TABLE academy_course_completion_policy ADD COLUMN tenant_id TEXT;
ALTER TABLE academy_course_completion_policy ADD COLUMN course_title TEXT;
ALTER TABLE academy_quiz_policies ADD COLUMN tenant_id TEXT;
ALTER TABLE academy_quiz_policy_history ADD COLUMN tenant_id TEXT;
ALTER TABLE academy_quiz_attempt_reviews ADD COLUMN tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_academy_progress_tenant
ON academy_progress(tenant_id, student_id, course_id);

CREATE INDEX IF NOT EXISTS idx_academy_attempts_tenant
ON academy_quiz_attempts(tenant_id, quiz_id, student_id, attempt_number);

CREATE INDEX IF NOT EXISTS idx_academy_certificates_tenant
ON academy_certificates(tenant_id, student_id, course_id, status);

CREATE INDEX IF NOT EXISTS idx_academy_completion_policy_tenant
ON academy_course_completion_policy(tenant_id, course_id);

CREATE INDEX IF NOT EXISTS idx_academy_quiz_policy_tenant
ON academy_quiz_policies(tenant_id, quiz_id, status);

CREATE TABLE IF NOT EXISTS academy_audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_roles_json TEXT NOT NULL DEFAULT '[]',
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academy_audit_tenant_created
ON academy_audit_events(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_academy_audit_resource
ON academy_audit_events(tenant_id, resource_type, resource_id, created_at DESC);
