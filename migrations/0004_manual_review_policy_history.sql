PRAGMA foreign_keys = ON;

ALTER TABLE academy_quiz_attempts ADD COLUMN policy_version INTEGER;

CREATE TABLE IF NOT EXISTS academy_quiz_attempt_reviews (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewer_name TEXT,
  awarded_points REAL NOT NULL CHECK(awarded_points >= 0),
  max_points REAL NOT NULL CHECK(max_points >= 0),
  note TEXT,
  reviewed_at TEXT NOT NULL,
  UNIQUE (attempt_id, question_id),
  FOREIGN KEY (attempt_id) REFERENCES academy_quiz_attempts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_academy_attempt_reviews_attempt
ON academy_quiz_attempt_reviews(attempt_id, reviewed_at);

CREATE TABLE IF NOT EXISTS academy_quiz_policy_history (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  course_id TEXT,
  version INTEGER NOT NULL CHECK(version > 0),
  minimum_score REAL NOT NULL CHECK(minimum_score BETWEEN 0 AND 100),
  attempts_allowed INTEGER CHECK(attempts_allowed IS NULL OR attempts_allowed > 0),
  randomize_questions INTEGER NOT NULL DEFAULT 0 CHECK(randomize_questions IN (0,1)),
  questions_json TEXT NOT NULL,
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  UNIQUE (quiz_id, version)
);

CREATE INDEX IF NOT EXISTS idx_academy_quiz_policy_history_lookup
ON academy_quiz_policy_history(quiz_id, version DESC);
