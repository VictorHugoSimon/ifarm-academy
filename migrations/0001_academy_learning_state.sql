PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_progress (
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK(progress_percent BETWEEN 0 AND 100),
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_id, course_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS academy_quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL CHECK(attempt_number > 0),
  status TEXT NOT NULL CHECK(status IN ('in_progress','submitted','manual_review','approved','failed')),
  answers_json TEXT NOT NULL DEFAULT '[]',
  automatic_result_json TEXT,
  manual_points REAL,
  manual_total_points REAL,
  final_percentage REAL CHECK(final_percentage IS NULL OR (final_percentage BETWEEN 0 AND 100)),
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  reviewed_at TEXT,
  reviewer_name TEXT,
  review_note TEXT,
  UNIQUE (quiz_id, student_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS academy_certificates (
  id TEXT PRIMARY KEY,
  public_code TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_title TEXT NOT NULL,
  final_score REAL,
  issued_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('valid','revoked')),
  UNIQUE (student_id, course_id, status)
);

CREATE INDEX IF NOT EXISTS idx_academy_progress_course ON academy_progress(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_academy_attempts_lookup ON academy_quiz_attempts(quiz_id, student_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_lookup ON academy_certificates(student_id, course_id);
