PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_tutor_usage_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('tenant','course','student')),
  scope_id TEXT,
  period TEXT NOT NULL CHECK(period IN ('day','month')),
  version INTEGER NOT NULL CHECK(version >= 1),
  max_provider_requests INTEGER CHECK(max_provider_requests IS NULL OR max_provider_requests > 0),
  max_request_chars INTEGER CHECK(max_request_chars IS NULL OR max_request_chars > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 10 AND 600),
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  CHECK(max_provider_requests IS NOT NULL OR max_request_chars IS NOT NULL),
  CHECK(
    (scope_type='tenant' AND scope_id IS NULL)
    OR (scope_type IN ('course','student') AND scope_id IS NOT NULL AND length(trim(scope_id)) > 0)
  ),
  CHECK(
    (status='active' AND archived_at IS NULL)
    OR (status='archived' AND archived_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_usage_policy_version
ON academy_tutor_usage_policies(
  tenant_id,
  scope_type,
  COALESCE(scope_id,''),
  period,
  version
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_usage_policy_active
ON academy_tutor_usage_policies(
  tenant_id,
  scope_type,
  COALESCE(scope_id,''),
  period
)
WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_tutor_usage_policy_tenant_status
ON academy_tutor_usage_policies(tenant_id, status, scope_type, period, created_at DESC);

CREATE TABLE IF NOT EXISTS academy_tutor_usage_reservations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  request_chars INTEGER NOT NULL CHECK(request_chars > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','consumed','released')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  finalized_at TEXT,
  FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE,
  CHECK(
    (status='reserved' AND finalized_at IS NULL)
    OR (status IN ('consumed','released') AND finalized_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tutor_usage_reservations_active
ON academy_tutor_usage_reservations(tenant_id, status, expires_at, course_id, student_id);

ALTER TABLE academy_tutor_provider_events
ADD COLUMN reservation_id TEXT;

CREATE TABLE IF NOT EXISTS academy_tutor_guardrail_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('prompt_risk','quota_block')),
  reason_code TEXT NOT NULL,
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  policy_id TEXT,
  provider_blocked INTEGER NOT NULL DEFAULT 1 CHECK(provider_blocked IN (0,1)),
  question_chars INTEGER NOT NULL DEFAULT 0 CHECK(question_chars BETWEEN 0 AND 2000),
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK(evidence_count BETWEEN 0 AND 5),
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES academy_tutor_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE,
  FOREIGN KEY(policy_id) REFERENCES academy_tutor_usage_policies(id)
);

CREATE INDEX IF NOT EXISTS idx_tutor_guardrail_events_tenant
ON academy_tutor_guardrail_events(tenant_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_guardrail_events_course
ON academy_tutor_guardrail_events(tenant_id, course_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_tutor_usage_policy_scope_insert
BEFORE INSERT ON academy_tutor_usage_policies
BEGIN
  SELECT CASE WHEN NEW.scope_type='course' AND NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.scope_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'tutor_usage_policy_invalid_course') END;

  SELECT CASE WHEN NEW.scope_type='student' AND NOT EXISTS (
    SELECT 1 FROM academy_enrollments e
    WHERE e.student_id=NEW.scope_id AND e.tenant_id=NEW.tenant_id
    LIMIT 1
  ) THEN RAISE(ABORT, 'tutor_usage_policy_invalid_student') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_usage_policy_update_guard
BEFORE UPDATE ON academy_tutor_usage_policies
BEGIN
  SELECT CASE WHEN OLD.status<>'active' OR NEW.status<>'archived'
    THEN RAISE(ABORT, 'tutor_usage_policy_invalid_transition') END;

  SELECT CASE WHEN NEW.id IS NOT OLD.id
    OR NEW.tenant_id IS NOT OLD.tenant_id
    OR NEW.scope_type IS NOT OLD.scope_type
    OR NEW.scope_id IS NOT OLD.scope_id
    OR NEW.period IS NOT OLD.period
    OR NEW.version IS NOT OLD.version
    OR NEW.max_provider_requests IS NOT OLD.max_provider_requests
    OR NEW.max_request_chars IS NOT OLD.max_request_chars
    OR NEW.rationale IS NOT OLD.rationale
    OR NEW.approved_by IS NOT OLD.approved_by
    OR NEW.approved_at IS NOT OLD.approved_at
    OR NEW.created_at IS NOT OLD.created_at
    THEN RAISE(ABORT, 'tutor_usage_policy_version_immutable') END;

  SELECT CASE WHEN NEW.archived_at IS NULL
    THEN RAISE(ABORT, 'tutor_usage_policy_archive_timestamp_required') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_usage_policy_delete_guard
BEFORE DELETE ON academy_tutor_usage_policies
BEGIN
  SELECT RAISE(ABORT, 'tutor_usage_policy_delete_forbidden');
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_usage_reservation_scope_insert
BEFORE INSERT ON academy_tutor_usage_reservations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id AND c.status='published'
  ) THEN RAISE(ABORT, 'tutor_usage_reservation_invalid_course') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_enrollments e
    WHERE e.tenant_id=NEW.tenant_id
      AND e.course_id=NEW.course_id
      AND e.student_id=NEW.student_id
      AND e.status IN ('active','completed')
  ) THEN RAISE(ABORT, 'tutor_usage_reservation_invalid_student') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_tutor_usage_policies p
    WHERE p.tenant_id=NEW.tenant_id
      AND p.scope_type='tenant'
      AND p.status='active'
  ) THEN RAISE(ABORT, 'tutor_usage_tenant_policy_required') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM academy_tutor_usage_policies p
    WHERE p.tenant_id=NEW.tenant_id
      AND p.status='active'
      AND (
        p.scope_type='tenant'
        OR (p.scope_type='course' AND p.scope_id=NEW.course_id)
        OR (p.scope_type='student' AND p.scope_id=NEW.student_id)
      )
      AND p.max_provider_requests IS NOT NULL
      AND (
        (
          SELECT COUNT(*) FROM academy_tutor_provider_events e
          WHERE e.tenant_id=NEW.tenant_id
            AND e.outcome<>'config_error'
            AND e.created_at >= CASE p.period
              WHEN 'month' THEN substr(NEW.created_at,1,7) || '-01T00:00:00.000Z'
              ELSE substr(NEW.created_at,1,10) || 'T00:00:00.000Z'
            END
            AND (
              p.scope_type='tenant'
              OR (p.scope_type='course' AND e.course_id=p.scope_id)
              OR (p.scope_type='student' AND e.student_id=p.scope_id)
            )
        )
        +
        (
          SELECT COUNT(*) FROM academy_tutor_usage_reservations r
          WHERE r.tenant_id=NEW.tenant_id
            AND r.status='reserved'
            AND r.expires_at>NEW.created_at
            AND r.created_at >= CASE p.period
              WHEN 'month' THEN substr(NEW.created_at,1,7) || '-01T00:00:00.000Z'
              ELSE substr(NEW.created_at,1,10) || 'T00:00:00.000Z'
            END
            AND (
              p.scope_type='tenant'
              OR (p.scope_type='course' AND r.course_id=p.scope_id)
              OR (p.scope_type='student' AND r.student_id=p.scope_id)
            )
        )
        + 1
      ) > p.max_provider_requests
  ) THEN RAISE(ABORT, 'tutor_usage_provider_requests_limit') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM academy_tutor_usage_policies p
    WHERE p.tenant_id=NEW.tenant_id
      AND p.status='active'
      AND (
        p.scope_type='tenant'
        OR (p.scope_type='course' AND p.scope_id=NEW.course_id)
        OR (p.scope_type='student' AND p.scope_id=NEW.student_id)
      )
      AND p.max_request_chars IS NOT NULL
      AND (
        COALESCE((
          SELECT SUM(e.request_chars) FROM academy_tutor_provider_events e
          WHERE e.tenant_id=NEW.tenant_id
            AND e.outcome<>'config_error'
            AND e.created_at >= CASE p.period
              WHEN 'month' THEN substr(NEW.created_at,1,7) || '-01T00:00:00.000Z'
              ELSE substr(NEW.created_at,1,10) || 'T00:00:00.000Z'
            END
            AND (
              p.scope_type='tenant'
              OR (p.scope_type='course' AND e.course_id=p.scope_id)
              OR (p.scope_type='student' AND e.student_id=p.scope_id)
            )
        ),0)
        +
        COALESCE((
          SELECT SUM(r.request_chars) FROM academy_tutor_usage_reservations r
          WHERE r.tenant_id=NEW.tenant_id
            AND r.status='reserved'
            AND r.expires_at>NEW.created_at
            AND r.created_at >= CASE p.period
              WHEN 'month' THEN substr(NEW.created_at,1,7) || '-01T00:00:00.000Z'
              ELSE substr(NEW.created_at,1,10) || 'T00:00:00.000Z'
            END
            AND (
              p.scope_type='tenant'
              OR (p.scope_type='course' AND r.course_id=p.scope_id)
              OR (p.scope_type='student' AND r.student_id=p.scope_id)
            )
        ),0)
        + NEW.request_chars
      ) > p.max_request_chars
  ) THEN RAISE(ABORT, 'tutor_usage_request_chars_limit') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_usage_reservation_update_guard
BEFORE UPDATE ON academy_tutor_usage_reservations
BEGIN
  SELECT CASE WHEN OLD.status<>'reserved' OR NEW.status NOT IN ('consumed','released')
    THEN RAISE(ABORT, 'tutor_usage_reservation_invalid_transition') END;

  SELECT CASE WHEN NEW.id IS NOT OLD.id
    OR NEW.tenant_id IS NOT OLD.tenant_id
    OR NEW.student_id IS NOT OLD.student_id
    OR NEW.course_id IS NOT OLD.course_id
    OR NEW.request_chars IS NOT OLD.request_chars
    OR NEW.created_at IS NOT OLD.created_at
    OR NEW.expires_at IS NOT OLD.expires_at
    THEN RAISE(ABORT, 'tutor_usage_reservation_identity_immutable') END;

  SELECT CASE WHEN NEW.finalized_at IS NULL
    THEN RAISE(ABORT, 'tutor_usage_reservation_finalized_at_required') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_usage_reservation_delete_guard
BEFORE DELETE ON academy_tutor_usage_reservations
BEGIN
  SELECT RAISE(ABORT, 'tutor_usage_reservation_delete_forbidden');
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_guardrail_scope_insert
BEFORE INSERT ON academy_tutor_guardrail_events
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM academy_tutor_sessions s
    JOIN academy_courses c ON c.id=s.course_id AND c.tenant_id=s.tenant_id
    WHERE s.id=NEW.session_id
      AND s.tenant_id=NEW.tenant_id
      AND s.student_id=NEW.student_id
      AND s.course_id=NEW.course_id
  ) THEN RAISE(ABORT, 'tutor_guardrail_invalid_scope') END;

  SELECT CASE WHEN NEW.policy_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_tutor_usage_policies p
    WHERE p.id=NEW.policy_id AND p.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'tutor_guardrail_invalid_policy') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_guardrail_immutable_update
BEFORE UPDATE ON academy_tutor_guardrail_events
BEGIN
  SELECT RAISE(ABORT, 'tutor_guardrail_event_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_guardrail_immutable_delete
BEFORE DELETE ON academy_tutor_guardrail_events
BEGIN
  SELECT RAISE(ABORT, 'tutor_guardrail_event_immutable');
END;

-- Toda tentativa externa real deve estar associada a uma reserva de quota já consumida.
-- config_error permanece sem reserva porque nenhum transporte externo aconteceu.
CREATE TRIGGER IF NOT EXISTS trg_tutor_provider_requires_tenant_quota
BEFORE INSERT ON academy_tutor_provider_events
WHEN NEW.outcome<>'config_error'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_tutor_usage_policies p
    WHERE p.tenant_id=NEW.tenant_id
      AND p.scope_type='tenant'
      AND p.status='active'
  ) THEN RAISE(ABORT, 'tutor_provider_requires_tenant_usage_policy') END;

  SELECT CASE WHEN NEW.reservation_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM academy_tutor_usage_reservations r
    WHERE r.id=NEW.reservation_id
      AND r.tenant_id=NEW.tenant_id
      AND r.student_id=NEW.student_id
      AND r.course_id=NEW.course_id
      AND r.request_chars=NEW.request_chars
      AND r.status='consumed'
  ) THEN RAISE(ABORT, 'tutor_provider_requires_consumed_reservation') END;
END;
