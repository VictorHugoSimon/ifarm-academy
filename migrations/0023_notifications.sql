PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('academic','compliance','event','commercial','system')),
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_path TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','important','urgent')),
  status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','read','archived')),
  required INTEGER NOT NULL DEFAULT 0 CHECK(required IN (0,1)),
  source_type TEXT,
  source_id TEXT,
  dedupe_key TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  read_at TEXT,
  archived_at TEXT,
  expires_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
ON academy_notifications(tenant_id,user_id,dedupe_key)
WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_inbox
ON academy_notifications(tenant_id,user_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS academy_notification_preferences (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('academic','compliance','event','commercial','system')),
  in_app_enabled INTEGER NOT NULL DEFAULT 1 CHECK(in_app_enabled IN (0,1)),
  email_enabled INTEGER NOT NULL DEFAULT 0 CHECK(email_enabled IN (0,1)),
  push_enabled INTEGER NOT NULL DEFAULT 0 CHECK(push_enabled IN (0,1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id,user_id,category)
);

CREATE TRIGGER IF NOT EXISTS trg_notification_state_insert
BEFORE INSERT ON academy_notifications
BEGIN
  SELECT CASE WHEN NEW.status='read' AND NEW.read_at IS NULL
    THEN RAISE(ABORT, 'read notification requires read_at') END;
  SELECT CASE WHEN NEW.status='archived' AND NEW.archived_at IS NULL
    THEN RAISE(ABORT, 'archived notification requires archived_at') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_notification_state_update
BEFORE UPDATE ON academy_notifications
BEGIN
  SELECT CASE WHEN NEW.tenant_id!=OLD.tenant_id OR NEW.user_id!=OLD.user_id
    THEN RAISE(ABORT, 'notification identity is immutable') END;
  SELECT CASE WHEN NEW.status='read' AND NEW.read_at IS NULL
    THEN RAISE(ABORT, 'read notification requires read_at') END;
  SELECT CASE WHEN NEW.status='archived' AND NEW.archived_at IS NULL
    THEN RAISE(ABORT, 'archived notification requires archived_at') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_notification_external_channels_insert
BEFORE INSERT ON academy_notification_preferences
BEGIN
  SELECT CASE WHEN NEW.email_enabled!=0 OR NEW.push_enabled!=0
    THEN RAISE(ABORT, 'external notification channels are not enabled in v0.38') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_notification_external_channels_update
BEFORE UPDATE ON academy_notification_preferences
BEGIN
  SELECT CASE WHEN NEW.email_enabled!=0 OR NEW.push_enabled!=0
    THEN RAISE(ABORT, 'external notification channels are not enabled in v0.38') END;
END;
