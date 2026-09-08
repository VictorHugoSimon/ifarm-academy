PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_tutor_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_academy_tutor_sessions_user
ON academy_tutor_sessions(tenant_id, user_id, course_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS academy_tutor_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL CHECK(length(trim(content)) > 0),
  response_mode TEXT NOT NULL DEFAULT 'evidence_only' CHECK(response_mode IN ('evidence_only','provider')),
  citations_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES academy_tutor_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_academy_tutor_messages_session
ON academy_tutor_messages(tenant_id, user_id, session_id, created_at, id);

CREATE TRIGGER IF NOT EXISTS trg_tutor_session_scope_insert
BEFORE INSERT ON academy_tutor_sessions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM academy_courses c
    JOIN academy_enrollments e
      ON e.tenant_id=c.tenant_id AND e.course_id=c.id
    WHERE c.id=NEW.course_id
      AND c.tenant_id=NEW.tenant_id
      AND c.status IN ('published','archived')
      AND e.student_id=NEW.user_id
      AND e.status IN ('active','completed')
  ) THEN RAISE(ABORT, 'academy_tutor_sessions enrollment/tenant/course mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_session_identity_immutable
BEFORE UPDATE ON academy_tutor_sessions
WHEN NEW.tenant_id<>OLD.tenant_id OR NEW.user_id<>OLD.user_id OR NEW.course_id<>OLD.course_id
BEGIN
  SELECT RAISE(ABORT, 'academy_tutor_sessions identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_message_scope_insert
BEFORE INSERT ON academy_tutor_messages
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_tutor_sessions s
    WHERE s.id=NEW.session_id
      AND s.tenant_id=NEW.tenant_id
      AND s.user_id=NEW.user_id
      AND s.course_id=NEW.course_id
      AND s.status='active'
  ) THEN RAISE(ABORT, 'academy_tutor_messages session mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_messages_append_only_update
BEFORE UPDATE ON academy_tutor_messages
BEGIN
  SELECT RAISE(ABORT, 'academy_tutor_messages are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_messages_append_only_delete
BEFORE DELETE ON academy_tutor_messages
BEGIN
  SELECT RAISE(ABORT, 'academy_tutor_messages are append-only');
END;
