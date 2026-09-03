PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_marketplace_submissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  submitter_instructor_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','under_review','changes_requested','approved','rejected','published','withdrawn')),
  submission_note TEXT,
  review_note TEXT,
  submitted_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  published_by TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, course_id, submitter_instructor_id),
  FOREIGN KEY (course_id) REFERENCES academy_courses(id) ON DELETE RESTRICT,
  FOREIGN KEY (submitter_instructor_id) REFERENCES academy_instructors(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS academy_marketplace_commission_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
  calculation_mode TEXT NOT NULL CHECK(calculation_mode IN ('percentage','fixed_amount')),
  ifarm_share_value INTEGER NOT NULL CHECK(ifarm_share_value >= 0),
  instructor_share_value INTEGER NOT NULL CHECK(instructor_share_value >= 0),
  partner_share_value INTEGER NOT NULL DEFAULT 0 CHECK(partner_share_value >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  gateway_fee_responsibility TEXT NOT NULL CHECK(gateway_fee_responsibility IN ('ifarm','instructor','partner','shared')),
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  rationale TEXT NOT NULL,
  confirmed_by TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, submission_id, version),
  FOREIGN KEY (submission_id) REFERENCES academy_marketplace_submissions(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_active_commission_rule
ON academy_marketplace_commission_rules(tenant_id, submission_id)
WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_marketplace_submissions_status
ON academy_marketplace_submissions(tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_rules_submission
ON academy_marketplace_commission_rules(tenant_id, submission_id, version DESC);

CREATE TRIGGER IF NOT EXISTS trg_marketplace_submission_integrity_insert
BEFORE INSERT ON academy_marketplace_submissions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'marketplace submission tenant/course mismatch') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_instructors i
    WHERE i.id=NEW.submitter_instructor_id AND i.tenant_id=NEW.tenant_id AND i.status='active'
  ) THEN RAISE(ABORT, 'marketplace submission tenant/instructor mismatch') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_course_instructor_roles r
    WHERE r.tenant_id=NEW.tenant_id
      AND r.course_id=NEW.course_id
      AND r.instructor_id=NEW.submitter_instructor_id
      AND r.role IN ('author','instructor')
      AND r.status='active'
  ) THEN RAISE(ABORT, 'marketplace submitter must be active course author or instructor') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_marketplace_submission_identity_update
BEFORE UPDATE ON academy_marketplace_submissions
BEGIN
  SELECT CASE WHEN NEW.tenant_id != OLD.tenant_id OR NEW.course_id != OLD.course_id OR NEW.submitter_instructor_id != OLD.submitter_instructor_id
  THEN RAISE(ABORT, 'marketplace submission identity is immutable') END;

  SELECT CASE WHEN NEW.status='published' AND NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id AND c.status='published'
  ) THEN RAISE(ABORT, 'marketplace publication requires published course') END;

  SELECT CASE WHEN NEW.status='published' AND NOT EXISTS (
    SELECT 1 FROM academy_marketplace_commission_rules r
    WHERE r.tenant_id=NEW.tenant_id
      AND r.submission_id=NEW.id
      AND r.status='active'
      AND datetime(r.valid_from) <= datetime('now')
      AND (r.valid_until IS NULL OR datetime(r.valid_until) > datetime('now'))
  ) THEN RAISE(ABORT, 'marketplace publication requires effective active commission rule') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_marketplace_commission_integrity_insert
BEFORE INSERT ON academy_marketplace_commission_rules
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_marketplace_submissions s
    WHERE s.id=NEW.submission_id AND s.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'marketplace commission tenant/submission mismatch') END;

  SELECT CASE WHEN NEW.status='active' AND NOT EXISTS (
    SELECT 1 FROM academy_marketplace_submissions s
    WHERE s.id=NEW.submission_id AND s.tenant_id=NEW.tenant_id AND s.status IN ('approved','published')
  ) THEN RAISE(ABORT, 'active marketplace commission requires approved submission') END;

  SELECT CASE WHEN NEW.calculation_mode='percentage' AND (
    NEW.ifarm_share_value > 10000 OR NEW.instructor_share_value > 10000 OR NEW.partner_share_value > 10000 OR
    NEW.ifarm_share_value + NEW.instructor_share_value + NEW.partner_share_value != 10000
  ) THEN RAISE(ABORT, 'marketplace percentage shares must total 10000 basis points') END;

  SELECT CASE WHEN NEW.calculation_mode='fixed_amount' AND (
    NEW.ifarm_share_value + NEW.instructor_share_value + NEW.partner_share_value <= 0
  ) THEN RAISE(ABORT, 'marketplace fixed shares must distribute a positive amount') END;

  SELECT CASE WHEN NEW.valid_until IS NOT NULL AND datetime(NEW.valid_until) <= datetime(NEW.valid_from)
  THEN RAISE(ABORT, 'marketplace commission valid_until must be after valid_from') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_marketplace_commission_integrity_update
BEFORE UPDATE ON academy_marketplace_commission_rules
BEGIN
  SELECT CASE WHEN NEW.tenant_id != OLD.tenant_id OR NEW.submission_id != OLD.submission_id OR NEW.version != OLD.version
  THEN RAISE(ABORT, 'marketplace commission identity is immutable') END;

  SELECT CASE WHEN NEW.calculation_mode='percentage' AND (
    NEW.ifarm_share_value > 10000 OR NEW.instructor_share_value > 10000 OR NEW.partner_share_value > 10000 OR
    NEW.ifarm_share_value + NEW.instructor_share_value + NEW.partner_share_value != 10000
  ) THEN RAISE(ABORT, 'marketplace percentage shares must total 10000 basis points') END;

  SELECT CASE WHEN NEW.calculation_mode='fixed_amount' AND (
    NEW.ifarm_share_value + NEW.instructor_share_value + NEW.partner_share_value <= 0
  ) THEN RAISE(ABORT, 'marketplace fixed shares must distribute a positive amount') END;
END;
