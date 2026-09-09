PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_tutor_provider_tenant_limits (
  tenant_id TEXT PRIMARY KEY,
  max_requests_per_day INTEGER NOT NULL CHECK(max_requests_per_day BETWEEN 1 AND 100000),
  max_request_chars_per_day INTEGER NOT NULL CHECK(max_request_chars_per_day BETWEEN 1000 AND 1000000000),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_tutor_provider_course_limits (
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  max_requests_per_student_day INTEGER NOT NULL CHECK(max_requests_per_student_day BETWEEN 1 AND 10000),
  max_requests_per_course_day INTEGER NOT NULL CHECK(max_requests_per_course_day BETWEEN 1 AND 100000),
  max_request_chars_per_course_day INTEGER NOT NULL CHECK(max_request_chars_per_course_day BETWEEN 1000 AND 1000000000),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(tenant_id, course_id),
  FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_tutor_provider_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  provider_mode TEXT NOT NULL CHECK(provider_mode IN ('disabled','gateway_v1')),
  decision TEXT NOT NULL CHECK(decision IN ('allowed','blocked')),
  reason TEXT NOT NULL CHECK(reason IN (
    'allowed',
    'course_not_authorized',
    'no_evidence',
    'provider_unavailable',
    'usage_policy_missing',
    'tenant_request_limit',
    'tenant_char_limit',
    'course_request_limit',
    'course_char_limit',
    'student_request_limit'
  )),
  estimated_request_chars INTEGER NOT NULL DEFAULT 0 CHECK(estimated_request_chars >= 0),
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  user_opt_in INTEGER NOT NULL CHECK(user_opt_in=1),
  consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES academy_tutor_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tutor_provider_decisions_tenant_day
ON academy_tutor_provider_decisions(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_provider_decisions_course_day
ON academy_tutor_provider_decisions(tenant_id, course_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_provider_events_student_day
ON academy_tutor_provider_events(tenant_id, student_id, course_id, created_at DESC);

ALTER TABLE academy_tutor_provider_events
ADD COLUMN risk_flags_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE academy_tutor_provider_events
ADD COLUMN user_opt_in INTEGER NOT NULL DEFAULT 1 CHECK(user_opt_in=1);

ALTER TABLE academy_tutor_provider_events
ADD COLUMN consent_version TEXT NOT NULL DEFAULT 'tutor-external-generation-v1';

CREATE TRIGGER IF NOT EXISTS trg_tutor_generation_requires_usage_limits_insert
BEFORE INSERT ON academy_tutor_course_policies
WHEN NEW.generative_enabled=1
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_tutor_provider_tenant_limits t WHERE t.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'tutor_generation_requires_tenant_limits') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_tutor_provider_course_limits c
    WHERE c.tenant_id=NEW.tenant_id AND c.course_id=NEW.course_id
  ) THEN RAISE(ABORT, 'tutor_generation_requires_course_limits') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_generation_requires_usage_limits_update
BEFORE UPDATE OF generative_enabled ON academy_tutor_course_policies
WHEN NEW.generative_enabled=1
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_tutor_provider_tenant_limits t WHERE t.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'tutor_generation_requires_tenant_limits') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_tutor_provider_course_limits c
    WHERE c.tenant_id=NEW.tenant_id AND c.course_id=NEW.course_id
  ) THEN RAISE(ABORT, 'tutor_generation_requires_course_limits') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_provider_decision_scope_insert
BEFORE INSERT ON academy_tutor_provider_decisions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_tutor_sessions s
    WHERE s.id=NEW.session_id
      AND s.tenant_id=NEW.tenant_id
      AND s.student_id=NEW.student_id
      AND s.course_id=NEW.course_id
  ) THEN RAISE(ABORT, 'tutor_provider_decision_invalid_scope') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_provider_decision_immutable_update
BEFORE UPDATE ON academy_tutor_provider_decisions
BEGIN
  SELECT RAISE(ABORT, 'tutor_provider_decision_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_provider_decision_immutable_delete
BEFORE DELETE ON academy_tutor_provider_decisions
BEGIN
  SELECT RAISE(ABORT, 'tutor_provider_decision_immutable');
END;
