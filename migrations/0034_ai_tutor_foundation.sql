PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_tutor_source_chunks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL CHECK(chunk_index >= 0),
  source_title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('lesson_body','lesson_instructions')),
  content_text TEXT NOT NULL CHECK(length(content_text) BETWEEN 1 AND 4000),
  content_hash TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  UNIQUE(tenant_id, lesson_id, chunk_index, source_type),
  FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE,
  FOREIGN KEY(lesson_id) REFERENCES academy_course_lessons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tutor_chunks_course
ON academy_tutor_source_chunks(tenant_id, course_id, lesson_id, chunk_index);

CREATE TABLE IF NOT EXISTS academy_tutor_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tutor_sessions_student
ON academy_tutor_sessions(tenant_id, student_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS academy_tutor_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  mode TEXT NOT NULL CHECK(mode IN ('user_input','evidence_only','insufficient_context','provider_generated')),
  content_text TEXT NOT NULL CHECK(length(content_text) BETWEEN 1 AND 12000),
  citations_json TEXT NOT NULL DEFAULT '[]',
  provider TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES academy_tutor_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tutor_messages_session
ON academy_tutor_messages(tenant_id, session_id, created_at, id);

CREATE TRIGGER IF NOT EXISTS trg_tutor_chunk_tenant_guard_insert
BEFORE INSERT ON academy_tutor_source_chunks
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM academy_courses c
    JOIN academy_course_lessons l ON l.course_id=c.id AND l.tenant_id=c.tenant_id
    WHERE c.id=NEW.course_id
      AND l.id=NEW.lesson_id
      AND c.tenant_id=NEW.tenant_id
      AND c.status='published'
  ) THEN RAISE(ABORT, 'tutor_source_invalid_scope') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_session_tenant_guard_insert
BEFORE INSERT ON academy_tutor_sessions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id AND c.status='published'
  ) THEN RAISE(ABORT, 'tutor_session_invalid_course') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tutor_message_scope_insert
BEFORE INSERT ON academy_tutor_messages
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_tutor_sessions s
    WHERE s.id=NEW.session_id
      AND s.tenant_id=NEW.tenant_id
      AND s.student_id=NEW.student_id
  ) THEN RAISE(ABORT, 'tutor_message_invalid_session') END;
END;
