PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS academy_learning_cycles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  cycle_number INTEGER NOT NULL CHECK(cycle_number > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
  source TEXT NOT NULL DEFAULT 'enrollment',
  company_id TEXT,
  member_id TEXT,
  renewal_of_cycle_id TEXT,
  due_at TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, student_id, course_id, cycle_number),
  FOREIGN KEY (enrollment_id) REFERENCES academy_enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_learning_cycle_open
ON academy_learning_cycles(tenant_id, student_id, course_id)
WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_academy_learning_cycle_history
ON academy_learning_cycles(tenant_id, student_id, course_id, cycle_number DESC);

CREATE INDEX IF NOT EXISTS idx_academy_learning_cycle_company
ON academy_learning_cycles(tenant_id, company_id, status, due_at);

ALTER TABLE academy_enrollments ADD COLUMN active_cycle_id TEXT;

INSERT INTO academy_learning_cycles (
  id, tenant_id, enrollment_id, student_id, course_id, cycle_number,
  status, source, started_at, completed_at, created_at, updated_at
)
SELECT
  'LC-' || e.id || '-1',
  e.tenant_id,
  e.id,
  e.student_id,
  e.course_id,
  1,
  CASE WHEN e.status='completed' THEN 'completed' WHEN e.status='cancelled' THEN 'cancelled' ELSE 'active' END,
  e.source,
  e.enrolled_at,
  e.completed_at,
  e.enrolled_at,
  e.updated_at
FROM academy_enrollments e;

UPDATE academy_enrollments
SET active_cycle_id='LC-' || id || '-1'
WHERE active_cycle_id IS NULL;

DROP TRIGGER IF EXISTS trg_progress_tenant_integrity_insert;
DROP TRIGGER IF EXISTS trg_progress_tenant_integrity_update;
DROP INDEX IF EXISTS idx_academy_progress_course;
DROP INDEX IF EXISTS idx_academy_progress_tenant;
DROP INDEX IF EXISTS idx_academy_progress_tenant_course_student;
ALTER TABLE academy_progress RENAME TO academy_progress_legacy;

CREATE TABLE academy_progress (
  cycle_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK(progress_percent BETWEEN 0 AND 100),
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (cycle_id, lesson_id)
);

INSERT INTO academy_progress (
  cycle_id, student_id, course_id, lesson_id, progress_percent,
  completed_at, updated_at, tenant_id, last_position_seconds
)
SELECT
  COALESCE(e.active_cycle_id, 'LEGACY-PROGRESS-' || p.student_id || '-' || p.course_id),
  p.student_id, p.course_id, p.lesson_id, p.progress_percent,
  p.completed_at, p.updated_at, COALESCE(p.tenant_id, e.tenant_id), p.last_position_seconds
FROM academy_progress_legacy p
LEFT JOIN academy_enrollments e
  ON e.tenant_id=p.tenant_id AND e.student_id=p.student_id AND e.course_id=p.course_id;
DROP TABLE academy_progress_legacy;

CREATE INDEX idx_academy_progress_course ON academy_progress(cycle_id, course_id);
CREATE INDEX idx_academy_progress_tenant ON academy_progress(tenant_id, student_id, course_id, cycle_id);
CREATE INDEX idx_academy_progress_tenant_course_student ON academy_progress(tenant_id, course_id, student_id, cycle_id, progress_percent);

DROP TRIGGER IF EXISTS trg_attempt_tenant_integrity_insert;
DROP INDEX IF EXISTS idx_academy_attempts_lookup;
DROP INDEX IF EXISTS idx_academy_attempts_tenant;
ALTER TABLE academy_quiz_attempt_reviews RENAME TO academy_quiz_attempt_reviews_legacy;
ALTER TABLE academy_quiz_attempts RENAME TO academy_quiz_attempts_legacy;

CREATE TABLE academy_quiz_attempts (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
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
  policy_version INTEGER,
  tenant_id TEXT NOT NULL,
  student_name_snapshot TEXT,
  UNIQUE (cycle_id, quiz_id, attempt_number)
);

INSERT INTO academy_quiz_attempts (
  id, cycle_id, quiz_id, student_id, attempt_number, status, answers_json,
  automatic_result_json, manual_points, manual_total_points, final_percentage,
  started_at, submitted_at, reviewed_at, reviewer_name, review_note,
  policy_version, tenant_id, student_name_snapshot
)
SELECT
  a.id,
  COALESCE((
    SELECT e.active_cycle_id
    FROM academy_course_completion_policy cp
    JOIN academy_enrollments e
      ON e.tenant_id=cp.tenant_id AND e.course_id=cp.course_id AND e.student_id=a.student_id
    WHERE cp.tenant_id=a.tenant_id AND cp.quiz_id=a.quiz_id
    LIMIT 1
  ), 'LEGACY-ATTEMPT-' || a.id),
  a.quiz_id, a.student_id, a.attempt_number, a.status, a.answers_json,
  a.automatic_result_json, a.manual_points, a.manual_total_points, a.final_percentage,
  a.started_at, a.submitted_at, a.reviewed_at, a.reviewer_name, a.review_note,
  a.policy_version, a.tenant_id, a.student_name_snapshot
FROM academy_quiz_attempts_legacy a;

CREATE TABLE academy_quiz_attempt_reviews (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewer_name TEXT,
  awarded_points REAL NOT NULL CHECK(awarded_points >= 0),
  max_points REAL NOT NULL CHECK(max_points >= 0),
  note TEXT,
  reviewed_at TEXT NOT NULL,
  tenant_id TEXT,
  UNIQUE (attempt_id, question_id),
  FOREIGN KEY (attempt_id) REFERENCES academy_quiz_attempts(id) ON DELETE CASCADE
);

INSERT INTO academy_quiz_attempt_reviews (
  id, attempt_id, question_id, reviewer_id, reviewer_name,
  awarded_points, max_points, note, reviewed_at, tenant_id
)
SELECT id, attempt_id, question_id, reviewer_id, reviewer_name,
  awarded_points, max_points, note, reviewed_at, tenant_id
FROM academy_quiz_attempt_reviews_legacy;

DROP TABLE academy_quiz_attempt_reviews_legacy;
DROP TABLE academy_quiz_attempts_legacy;
CREATE INDEX idx_academy_attempts_lookup ON academy_quiz_attempts(cycle_id, quiz_id, attempt_number);
CREATE INDEX idx_academy_attempts_tenant ON academy_quiz_attempts(tenant_id, quiz_id, student_id, cycle_id, attempt_number);
CREATE INDEX idx_academy_attempt_reviews_attempt ON academy_quiz_attempt_reviews(attempt_id, reviewed_at);

DROP TRIGGER IF EXISTS trg_certificate_tenant_integrity_insert;
DROP INDEX IF EXISTS idx_academy_certificates_lookup;
DROP INDEX IF EXISTS idx_academy_certificates_tenant;
DROP INDEX IF EXISTS idx_academy_certificates_public_status;
ALTER TABLE academy_certificates RENAME TO academy_certificates_legacy;

CREATE TABLE academy_certificates (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  public_code TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_title TEXT NOT NULL,
  final_score REAL,
  issued_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('valid','revoked')),
  tenant_id TEXT NOT NULL,
  workload_minutes INTEGER,
  instructor_label TEXT,
  certificate_type TEXT NOT NULL DEFAULT 'free_course',
  completion_date TEXT,
  metadata_version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, student_id, course_id, cycle_id)
);

INSERT INTO academy_certificates (
  id, cycle_id, public_code, student_id, student_name, course_id, course_title,
  final_score, issued_at, status, tenant_id, workload_minutes, instructor_label,
  certificate_type, completion_date, metadata_version
)
SELECT
  c.id,
  COALESCE((SELECT e.active_cycle_id FROM academy_enrollments e
    WHERE e.tenant_id=c.tenant_id AND e.student_id=c.student_id AND e.course_id=c.course_id LIMIT 1), 'LEGACY-CERT-' || c.id),
  c.public_code, c.student_id, c.student_name, c.course_id, c.course_title,
  c.final_score, c.issued_at, c.status, c.tenant_id, c.workload_minutes,
  c.instructor_label, c.certificate_type, c.completion_date, c.metadata_version
FROM academy_certificates_legacy c;
DROP TABLE academy_certificates_legacy;
CREATE INDEX idx_academy_certificates_lookup ON academy_certificates(student_id, course_id, cycle_id);
CREATE INDEX idx_academy_certificates_tenant ON academy_certificates(tenant_id, student_id, course_id, cycle_id, status);
CREATE INDEX idx_academy_certificates_public_status ON academy_certificates(public_code, status);

ALTER TABLE academy_course_assignments ADD COLUMN learning_cycle_id TEXT;
UPDATE academy_course_assignments
SET learning_cycle_id=(
  SELECT e.active_cycle_id
  FROM academy_company_members m
  JOIN academy_enrollments e
    ON e.tenant_id=academy_course_assignments.tenant_id
    AND e.student_id=m.user_id
    AND e.course_id=academy_course_assignments.course_id
  WHERE m.tenant_id=academy_course_assignments.tenant_id
    AND m.id=academy_course_assignments.member_id
  LIMIT 1
)
WHERE learning_cycle_id IS NULL;

CREATE TRIGGER trg_progress_tenant_integrity_insert
BEFORE INSERT ON academy_progress
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_learning_cycles lc
    WHERE lc.id=NEW.cycle_id AND lc.tenant_id=NEW.tenant_id
      AND lc.student_id=NEW.student_id AND lc.course_id=NEW.course_id
  ) THEN RAISE(ABORT, 'academy_progress cycle mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_course_lessons l
    WHERE l.id=NEW.lesson_id AND l.course_id=NEW.course_id AND l.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_progress tenant/course/lesson mismatch') END;
END;

CREATE TRIGGER trg_progress_tenant_integrity_update
BEFORE UPDATE ON academy_progress
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_learning_cycles lc
    WHERE lc.id=NEW.cycle_id AND lc.tenant_id=NEW.tenant_id
      AND lc.student_id=NEW.student_id AND lc.course_id=NEW.course_id
  ) THEN RAISE(ABORT, 'academy_progress cycle mismatch') END;
END;

CREATE TRIGGER trg_attempt_tenant_integrity_insert
BEFORE INSERT ON academy_quiz_attempts
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_learning_cycles lc
    JOIN academy_course_completion_policy cp
      ON cp.tenant_id=lc.tenant_id AND cp.course_id=lc.course_id
    WHERE lc.id=NEW.cycle_id AND lc.tenant_id=NEW.tenant_id
      AND lc.student_id=NEW.student_id AND cp.quiz_id=NEW.quiz_id
  ) THEN RAISE(ABORT, 'academy_quiz_attempts cycle/quiz mismatch') END;
END;

CREATE TRIGGER trg_certificate_tenant_integrity_insert
BEFORE INSERT ON academy_certificates
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_learning_cycles lc
    WHERE lc.id=NEW.cycle_id AND lc.tenant_id=NEW.tenant_id
      AND lc.student_id=NEW.student_id AND lc.course_id=NEW.course_id
      AND lc.status='completed'
  ) THEN RAISE(ABORT, 'academy_certificates cycle mismatch') END;
END;

PRAGMA foreign_keys = ON;
