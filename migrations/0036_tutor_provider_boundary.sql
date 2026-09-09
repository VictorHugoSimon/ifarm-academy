PRAGMA foreign_keys = ON;

ALTER TABLE academy_tutor_course_policies
ADD COLUMN generative_enabled INTEGER NOT NULL DEFAULT 0 CHECK(generative_enabled IN (0,1));

ALTER TABLE academy_tutor_course_policies
ADD COLUMN generative_approved_by TEXT;

ALTER TABLE academy_tutor_course_policies
ADD COLUMN generative_approved_at TEXT;

ALTER TABLE academy_tutor_course_policies
ADD COLUMN generative_approved_course_updated_at TEXT;

ALTER TABLE academy_tutor_course_policies
ADD COLUMN generative_disabled_at TEXT;

CREATE TABLE IF NOT EXISTS academy_tutor_provider_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  provider_mode TEXT NOT NULL CHECK(provider_mode IN ('disabled','gateway_v1')),
  outcome TEXT NOT NULL CHECK(outcome IN (
    'success','config_error','timeout','network_error','provider_error','invalid_response'
  )),
  latency_ms INTEGER NOT NULL DEFAULT 0 CHECK(latency_ms >= 0),
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK(evidence_count BETWEEN 0 AND 5),
  citation_count INTEGER NOT NULL DEFAULT 0 CHECK(citation_count BETWEEN 0 AND 5),
  request_chars INTEGER NOT NULL DEFAULT 0 CHECK(request_chars >= 0),
  response_chars INTEGER NOT NULL DEFAULT 0 CHECK(response_chars >= 0),
  fallback_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES academy_tutor_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tutor_provider_events_course
ON academy_tutor_provider_events(tenant_id, course_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_provider_events_outcome
ON academy_tutor_provider_events(tenant_id, outcome, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_tutor_generative_policy_guard_update
BEFORE UPDATE OF generative_enabled, generative_approved_by, generative_approved_at, generative_approved_course_updated_at
ON academy_tutor_course_policies
WHEN NEW.generative_enabled=1
BEGIN
  SELECT CASE WHEN NEW.enabled<>1
    THEN RAISE(ABORT, 'tutor_generation_requires_content_authorization') END;
  SELECT CASE WHEN NEW.generative_approved_by IS NULL
                OR NEW.generative_approved_at IS NULL
                OR NEW.generative_approved_course_updated_at IS NULL
    THEN RAISE(ABORT, 'tutor_generation_requires_explicit_approval') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id
      AND c.tenant_id=NEW.tenant_id
      AND c.status='published'
      AND c.updated_at=NEW.generative_approved_course_updated_at
  ) THEN RAISE(ABORT, 'tutor_generation_requires_current_published_course') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_content_disable_disables_generation
AFTER UPDATE OF enabled ON academy_tutor_course_policies
WHEN NEW.enabled=0 AND OLD.generative_enabled=1
BEGIN
  UPDATE academy_tutor_course_policies
  SET generative_enabled=0,
      generative_disabled_at=COALESCE(generative_disabled_at, NEW.updated_at),
      updated_at=NEW.updated_at
  WHERE tenant_id=NEW.tenant_id AND course_id=NEW.course_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_course_unpublish_disables_generation
AFTER UPDATE OF status ON academy_courses
WHEN NEW.status<>'published'
BEGIN
  UPDATE academy_tutor_course_policies
  SET generative_enabled=0,
      generative_disabled_at=COALESCE(generative_disabled_at, NEW.updated_at),
      updated_at=NEW.updated_at
  WHERE tenant_id=NEW.tenant_id AND course_id=NEW.id AND generative_enabled=1;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_provider_event_scope_insert
BEFORE INSERT ON academy_tutor_provider_events
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM academy_tutor_sessions s
    JOIN academy_courses c ON c.id=s.course_id AND c.tenant_id=s.tenant_id
    WHERE s.id=NEW.session_id
      AND s.tenant_id=NEW.tenant_id
      AND s.student_id=NEW.student_id
      AND s.course_id=NEW.course_id
  ) THEN RAISE(ABORT, 'tutor_provider_event_invalid_scope') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_provider_event_immutable_update
BEFORE UPDATE ON academy_tutor_provider_events
BEGIN
  SELECT RAISE(ABORT, 'tutor_provider_event_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_provider_event_immutable_delete
BEFORE DELETE ON academy_tutor_provider_events
BEGIN
  SELECT RAISE(ABORT, 'tutor_provider_event_immutable');
END;
