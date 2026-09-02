PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_quiz_policies (
  quiz_id TEXT PRIMARY KEY,
  course_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  minimum_score REAL NOT NULL DEFAULT 0 CHECK(minimum_score BETWEEN 0 AND 100),
  attempts_allowed INTEGER CHECK(attempts_allowed IS NULL OR attempts_allowed > 0),
  randomize_questions INTEGER NOT NULL DEFAULT 0 CHECK(randomize_questions IN (0,1)),
  questions_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  published_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academy_quiz_policy_course
ON academy_quiz_policies(course_id, status);
