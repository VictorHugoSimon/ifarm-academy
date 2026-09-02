PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_course_completion_policy (
  course_id TEXT PRIMARY KEY,
  required_lessons_count INTEGER NOT NULL CHECK(required_lessons_count >= 0),
  assessment_required INTEGER NOT NULL DEFAULT 0 CHECK(assessment_required IN (0,1)),
  quiz_id TEXT,
  minimum_score REAL CHECK(minimum_score IS NULL OR (minimum_score BETWEEN 0 AND 100)),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academy_completion_policy_quiz
ON academy_course_completion_policy(quiz_id);
