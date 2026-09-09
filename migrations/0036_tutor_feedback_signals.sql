PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_tutor_feedback (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK(rating IN ('helpful','not_helpful')),
  reason TEXT CHECK(reason IS NULL OR reason IN (
    'clear_answer','useful_source','missing_context','incorrect_source','unclear','other'
  )),
  note TEXT CHECK(note IS NULL OR length(note) <= 1000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, student_id, message_id),
  FOREIGN KEY(session_id) REFERENCES academy_tutor_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(message_id) REFERENCES academy_tutor_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tutor_feedback_tenant
ON academy_tutor_feedback(tenant_id, rating, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_feedback_session
ON academy_tutor_feedback(tenant_id, session_id, message_id);

CREATE TRIGGER IF NOT EXISTS trg_tutor_feedback_scope_insert
BEFORE INSERT ON academy_tutor_feedback
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM academy_tutor_messages m
    JOIN academy_tutor_sessions s ON s.id=m.session_id
    WHERE m.id=NEW.message_id
      AND m.session_id=NEW.session_id
      AND m.tenant_id=NEW.tenant_id
      AND m.student_id=NEW.student_id
      AND m.role='assistant'
      AND s.tenant_id=NEW.tenant_id
      AND s.student_id=NEW.student_id
  ) THEN RAISE(ABORT, 'tutor_feedback_invalid_scope') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_feedback_identity_immutable
BEFORE UPDATE OF tenant_id, session_id, message_id, student_id ON academy_tutor_feedback
BEGIN
  SELECT RAISE(ABORT, 'tutor_feedback_identity_immutable');
END;
