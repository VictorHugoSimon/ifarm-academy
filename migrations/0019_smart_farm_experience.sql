PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_smart_farm_agenda_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  activity_type TEXT NOT NULL CHECK(activity_type IN ('field_activity','demonstration','lecture','visit','break','other')),
  starts_at TEXT,
  ends_at TEXT,
  position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
  location_label TEXT,
  requires_practical_evidence INTEGER NOT NULL DEFAULT 0 CHECK(requires_practical_evidence IN (0,1)),
  interest_code TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES academy_events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_smart_farm_agenda_event
ON academy_smart_farm_agenda_items(tenant_id, event_id, position, starts_at);

CREATE TABLE IF NOT EXISTS academy_event_qr_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('checkin','checkout','station')),
  agenda_item_id TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  valid_from TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK(use_count >= 0),
  max_uses INTEGER CHECK(max_uses IS NULL OR max_uses > 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (event_id) REFERENCES academy_events(id) ON DELETE CASCADE,
  FOREIGN KEY (agenda_item_id) REFERENCES academy_smart_farm_agenda_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_qr_tokens_event
ON academy_event_qr_tokens(tenant_id, event_id, purpose, active, valid_until);

CREATE TABLE IF NOT EXISTS academy_event_practical_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  registration_id TEXT NOT NULL,
  agenda_item_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK(evidence_type IN ('qr','manual','geolocation','signature','document','asset_reference','checklist')),
  evidence_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','validated','rejected')),
  submitted_by TEXT NOT NULL,
  validated_by TEXT,
  validated_at TEXT,
  validation_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES academy_events(id) ON DELETE CASCADE,
  FOREIGN KEY (registration_id) REFERENCES academy_event_registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (agenda_item_id) REFERENCES academy_smart_farm_agenda_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_practical_evidence_registration
ON academy_event_practical_evidence(tenant_id, registration_id, agenda_item_id, status);

CREATE TABLE IF NOT EXISTS academy_event_commercial_leads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  registration_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  company_id TEXT,
  interest_code TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'smart_farm_experience',
  consent_source TEXT NOT NULL CHECK(consent_source IN ('explicit_event_interest','registration_marketing_consent')),
  consent_recorded_at TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN ('new','qualified','contacted','converted','discarded')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, event_id, registration_id, interest_code),
  FOREIGN KEY (event_id) REFERENCES academy_events(id) ON DELETE CASCADE,
  FOREIGN KEY (registration_id) REFERENCES academy_event_registrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_commercial_leads_stage
ON academy_event_commercial_leads(tenant_id, stage, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_smart_farm_agenda_tenant_insert
BEFORE INSERT ON academy_smart_farm_agenda_items
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_events e WHERE e.id=NEW.event_id AND e.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'smart farm agenda tenant/event mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_event_qr_token_tenant_insert
BEFORE INSERT ON academy_event_qr_tokens
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_events e WHERE e.id=NEW.event_id AND e.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'event qr token tenant/event mismatch') END;
  SELECT CASE WHEN NEW.agenda_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_smart_farm_agenda_items a
    WHERE a.id=NEW.agenda_item_id AND a.event_id=NEW.event_id AND a.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'event qr token agenda mismatch') END;
  SELECT CASE WHEN NEW.purpose='station' AND NEW.agenda_item_id IS NULL
    THEN RAISE(ABORT, 'station qr token requires agenda item') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_event_practical_evidence_tenant_insert
BEFORE INSERT ON academy_event_practical_evidence
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_event_registrations r
    WHERE r.id=NEW.registration_id AND r.event_id=NEW.event_id AND r.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'practical evidence tenant/registration mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_smart_farm_agenda_items a
    WHERE a.id=NEW.agenda_item_id AND a.event_id=NEW.event_id AND a.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'practical evidence agenda mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_event_commercial_lead_tenant_insert
BEFORE INSERT ON academy_event_commercial_leads
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_event_registrations r
    WHERE r.id=NEW.registration_id AND r.event_id=NEW.event_id
      AND r.tenant_id=NEW.tenant_id AND r.user_id=NEW.user_id
  ) THEN RAISE(ABORT, 'event lead tenant/registration mismatch') END;
  SELECT CASE WHEN NEW.company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM academy_companies c WHERE c.id=NEW.company_id AND c.tenant_id=NEW.tenant_id
  ) THEN RAISE(ABORT, 'event lead tenant/company mismatch') END;
END;
