PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_gamification_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'lesson_completed','course_completed','quiz_approved','certificate_issued','event_attended','smart_farm_activity'
  )),
  points INTEGER NOT NULL CHECK(points >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
  version INTEGER NOT NULL CHECK(version > 0),
  rationale TEXT NOT NULL,
  configured_by TEXT NOT NULL,
  configured_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, event_type, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_rule_active
ON academy_gamification_rules(tenant_id, event_type)
WHERE status='active';

CREATE TABLE IF NOT EXISTS academy_points_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  points INTEGER NOT NULL CHECK(points >= 0),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, user_id, event_type, source_type, source_id),
  FOREIGN KEY (rule_id) REFERENCES academy_gamification_rules(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user
ON academy_points_ledger(tenant_id, user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS academy_badges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  criterion_type TEXT NOT NULL CHECK(criterion_type IN ('xp_total','event_count')),
  criterion_event_type TEXT,
  criterion_value INTEGER NOT NULL CHECK(criterion_value > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, code),
  CHECK(
    (criterion_type='xp_total' AND criterion_event_type IS NULL)
    OR
    (criterion_type='event_count' AND criterion_event_type IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS academy_user_badges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE (tenant_id, user_id, badge_id),
  FOREIGN KEY (badge_id) REFERENCES academy_badges(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user
ON academy_user_badges(tenant_id, user_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS academy_gamification_levels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  min_xp INTEGER NOT NULL CHECK(min_xp >= 0),
  position INTEGER NOT NULL CHECK(position >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, min_xp),
  UNIQUE (tenant_id, position)
);

CREATE TABLE IF NOT EXISTS academy_streaks (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  current_days INTEGER NOT NULL DEFAULT 0 CHECK(current_days >= 0),
  best_days INTEGER NOT NULL DEFAULT 0 CHECK(best_days >= 0),
  last_activity_date TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TRIGGER IF NOT EXISTS trg_points_ledger_rule_tenant_insert
BEFORE INSERT ON academy_points_ledger
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_gamification_rules r
    WHERE r.id=NEW.rule_id AND r.tenant_id=NEW.tenant_id AND r.event_type=NEW.event_type
  ) THEN RAISE(ABORT, 'gamification ledger rule/tenant/event mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_user_badge_tenant_insert
BEFORE INSERT ON academy_user_badges
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_badges b
    WHERE b.id=NEW.badge_id AND b.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'gamification badge tenant mismatch') END;
END;
