PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL CHECK(event_type IN ('workshop','field_day','practical_class','training','webinar','other')),
  modality TEXT NOT NULL CHECK(modality IN ('in_person','online','hybrid')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','completed','cancelled')),
  access_model TEXT NOT NULL DEFAULT 'free' CHECK(access_model IN ('free','paid','sponsored')),
  price_cents INTEGER CHECK(price_cents IS NULL OR price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  registration_deadline TEXT,
  capacity INTEGER CHECK(capacity IS NULL OR capacity > 0),
  venue_name TEXT,
  address_text TEXT,
  meeting_url TEXT,
  smart_farm_experience INTEGER NOT NULL DEFAULT 0 CHECK(smart_farm_experience IN (0,1)),
  created_by TEXT NOT NULL,
  published_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_event_registrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name_snapshot TEXT NOT NULL,
  company_id TEXT,
  status TEXT NOT NULL DEFAULT 'registered' CHECK(status IN ('registered','waitlisted','cancelled','attended','no_show')),
  source TEXT NOT NULL DEFAULT 'academy',
  marketing_consent INTEGER NOT NULL DEFAULT 0 CHECK(marketing_consent IN (0,1)),
  registered_at TEXT NOT NULL,
  cancelled_at TEXT,
  checkin_at TEXT,
  checkout_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, event_id, user_id),
  FOREIGN KEY (event_id) REFERENCES academy_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_event_attendance_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  registration_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK(evidence_type IN ('manual','checkin_code','qr','geolocation','signature','document')),
  evidence_json TEXT NOT NULL DEFAULT '{}',
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES academy_events(id) ON DELETE CASCADE,
  FOREIGN KEY (registration_id) REFERENCES academy_event_registrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_academy_events_catalog
ON academy_events(tenant_id, status, starts_at);

CREATE INDEX IF NOT EXISTS idx_academy_events_smart_farm
ON academy_events(tenant_id, smart_farm_experience, starts_at);

CREATE INDEX IF NOT EXISTS idx_academy_event_registrations_event
ON academy_event_registrations(tenant_id, event_id, status, registered_at);

CREATE INDEX IF NOT EXISTS idx_academy_event_registrations_user
ON academy_event_registrations(tenant_id, user_id, registered_at DESC);

CREATE INDEX IF NOT EXISTS idx_academy_event_attendance_registration
ON academy_event_attendance_evidence(tenant_id, registration_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_event_registration_tenant_insert
BEFORE INSERT ON academy_event_registrations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_events e
    WHERE e.id=NEW.event_id AND e.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_event_registrations tenant/event mismatch') END;

  SELECT CASE WHEN NEW.company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_companies c
    WHERE c.id=NEW.company_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_event_registrations tenant/company mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_event_registration_tenant_update
BEFORE UPDATE ON academy_event_registrations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_events e
    WHERE e.id=NEW.event_id AND e.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_event_registrations tenant/event mismatch') END;

  SELECT CASE WHEN NEW.company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_companies c
    WHERE c.id=NEW.company_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_event_registrations tenant/company mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_event_attendance_tenant_insert
BEFORE INSERT ON academy_event_attendance_evidence
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_events e
    WHERE e.id=NEW.event_id AND e.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_event_attendance tenant/event mismatch') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_event_registrations r
    WHERE r.id=NEW.registration_id AND r.event_id=NEW.event_id AND r.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_event_attendance tenant/registration mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_event_attendance_tenant_update
BEFORE UPDATE ON academy_event_attendance_evidence
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_event_registrations r
    WHERE r.id=NEW.registration_id AND r.event_id=NEW.event_id AND r.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'academy_event_attendance tenant/registration mismatch') END;
END;
