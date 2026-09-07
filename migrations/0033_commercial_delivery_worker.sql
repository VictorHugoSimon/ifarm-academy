PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_commercial_handoff_claims (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  handoff_id TEXT NOT NULL,
  claim_token TEXT NOT NULL UNIQUE,
  worker_id TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  released_at TEXT,
  release_reason TEXT CHECK(release_reason IS NULL OR release_reason IN ('delivered','failed','timeout','cancelled')),
  FOREIGN KEY (handoff_id) REFERENCES academy_commercial_handoff_outbox(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_handoff_open_claim
ON academy_commercial_handoff_claims(tenant_id,handoff_id)
WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_commercial_handoff_claim_expiry
ON academy_commercial_handoff_claims(tenant_id,expires_at,seq);

CREATE TABLE IF NOT EXISTS academy_commercial_handoff_attempts (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  handoff_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL CHECK(attempt_number > 0),
  status TEXT NOT NULL CHECK(status IN ('processing','delivered','failed','timed_out')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  delivery_reference TEXT,
  error_code TEXT,
  FOREIGN KEY (handoff_id) REFERENCES academy_commercial_handoff_outbox(id) ON DELETE RESTRICT,
  FOREIGN KEY (claim_id) REFERENCES academy_commercial_handoff_claims(id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,handoff_id,attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_commercial_handoff_attempt_history
ON academy_commercial_handoff_attempts(tenant_id,handoff_id,attempt_number DESC);

CREATE TABLE IF NOT EXISTS academy_commercial_handoff_dead_letters (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  handoff_id TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts > 0),
  reason_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (handoff_id) REFERENCES academy_commercial_handoff_outbox(id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,handoff_id)
);

CREATE INDEX IF NOT EXISTS idx_commercial_handoff_dead_letter_queue
ON academy_commercial_handoff_dead_letters(tenant_id,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_commercial_claim_insert_guard
BEFORE INSERT ON academy_commercial_handoff_claims
BEGIN
  SELECT CASE WHEN trim(NEW.worker_id)='' OR trim(NEW.claim_token)=''
    THEN RAISE(ABORT,'commercial worker claim required fields missing') END;
  SELECT CASE WHEN datetime(NEW.expires_at)<=datetime(NEW.claimed_at)
    THEN RAISE(ABORT,'commercial worker claim expiry invalid') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_commercial_handoff_outbox h
    WHERE h.id=NEW.handoff_id AND h.tenant_id=NEW.tenant_id
      AND (
        (h.status='pending' AND (h.next_attempt_at IS NULL OR datetime(h.next_attempt_at)<=datetime(NEW.claimed_at)))
        OR
        (h.status='failed' AND h.next_attempt_at IS NOT NULL AND datetime(h.next_attempt_at)<=datetime(NEW.claimed_at))
      )
  ) THEN RAISE(ABORT,'commercial worker claim requires due handoff in same tenant') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM academy_commercial_handoff_outbox h
    JOIN academy_commercial_opportunities o ON o.tenant_id=h.tenant_id AND o.id=h.opportunity_id
    WHERE h.id=NEW.handoff_id AND h.tenant_id=NEW.tenant_id AND (
      (SELECT action FROM academy_commercial_contact_preference_events p
        WHERE p.tenant_id=o.tenant_id AND p.user_id=o.user_id ORDER BY p.seq DESC LIMIT 1)='suppress_all'
      OR
      (SELECT action FROM academy_commercial_opportunity_consent_events ce
        WHERE ce.tenant_id=o.tenant_id AND ce.opportunity_id=o.id AND ce.user_id=o.user_id ORDER BY ce.seq DESC LIMIT 1)='revoked'
    )
  ) THEN RAISE(ABORT,'commercial worker claim blocked by consent state') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_claim_update_guard
BEFORE UPDATE ON academy_commercial_handoff_claims
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.handoff_id!=OLD.handoff_id OR
    NEW.claim_token!=OLD.claim_token OR NEW.worker_id!=OLD.worker_id OR NEW.claimed_at!=OLD.claimed_at OR NEW.expires_at!=OLD.expires_at
    THEN RAISE(ABORT,'commercial worker claim identity is immutable') END;
  SELECT CASE WHEN OLD.released_at IS NOT NULL AND (NEW.released_at IS NOT OLD.released_at OR NEW.release_reason IS NOT OLD.release_reason)
    THEN RAISE(ABORT,'released commercial worker claim is immutable') END;
  SELECT CASE WHEN NEW.released_at IS NOT NULL AND NEW.release_reason IS NULL
    THEN RAISE(ABORT,'released commercial worker claim requires reason') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_attempt_insert_guard
BEFORE INSERT ON academy_commercial_handoff_attempts
BEGIN
  SELECT CASE WHEN trim(NEW.worker_id)=''
    THEN RAISE(ABORT,'commercial worker attempt requires worker') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_commercial_handoff_claims c
    WHERE c.id=NEW.claim_id AND c.tenant_id=NEW.tenant_id AND c.handoff_id=NEW.handoff_id
      AND c.worker_id=NEW.worker_id AND c.released_at IS NULL
  ) THEN RAISE(ABORT,'commercial worker attempt requires active matching claim') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_attempt_update_guard
BEFORE UPDATE ON academy_commercial_handoff_attempts
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.handoff_id!=OLD.handoff_id OR
    NEW.claim_id!=OLD.claim_id OR NEW.worker_id!=OLD.worker_id OR NEW.attempt_number!=OLD.attempt_number OR NEW.started_at!=OLD.started_at
    THEN RAISE(ABORT,'commercial worker attempt identity is immutable') END;
  SELECT CASE WHEN OLD.status!='processing'
    THEN RAISE(ABORT,'terminal commercial worker attempt is immutable') END;
  SELECT CASE WHEN NEW.status='processing' AND (NEW.completed_at IS NOT OLD.completed_at OR NEW.delivery_reference IS NOT OLD.delivery_reference OR NEW.error_code IS NOT OLD.error_code)
    THEN RAISE(ABORT,'processing commercial worker attempt cannot gain terminal fields') END;
  SELECT CASE WHEN NEW.status='delivered' AND (NEW.completed_at IS NULL OR NEW.delivery_reference IS NULL OR trim(NEW.delivery_reference)='')
    THEN RAISE(ABORT,'delivered worker attempt requires receipt') END;
  SELECT CASE WHEN NEW.status IN ('failed','timed_out') AND (NEW.completed_at IS NULL OR NEW.error_code IS NULL OR trim(NEW.error_code)='')
    THEN RAISE(ABORT,'failed worker attempt requires error code') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_dead_letter_insert_guard
BEFORE INSERT ON academy_commercial_handoff_dead_letters
BEGIN
  SELECT CASE WHEN trim(NEW.reason_code)=''
    THEN RAISE(ABORT,'commercial dead letter requires reason') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_commercial_handoff_outbox h
    WHERE h.id=NEW.handoff_id AND h.tenant_id=NEW.tenant_id AND h.status='failed' AND h.next_attempt_at IS NULL
  ) THEN RAISE(ABORT,'commercial dead letter requires terminal failed handoff') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_dead_letter_immutable
BEFORE UPDATE ON academy_commercial_handoff_dead_letters
BEGIN
  SELECT RAISE(ABORT,'commercial dead letter record is immutable');
END;
