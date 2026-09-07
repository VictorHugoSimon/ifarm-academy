PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_event_interest_unique
ON academy_commercial_opportunities(tenant_id,user_id,source_ref,interest_code)
WHERE source_type='event' AND consent_evidence_type IN ('explicit_event_interest','legacy_event_interest');

CREATE TRIGGER IF NOT EXISTS trg_commercial_legacy_event_match_insert
BEFORE INSERT ON academy_commercial_opportunities
WHEN NEW.legacy_event_lead_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_event_commercial_leads l
    WHERE l.id=NEW.legacy_event_lead_id
      AND l.tenant_id=NEW.tenant_id
      AND l.user_id=NEW.user_id
      AND l.event_id=NEW.source_ref
      AND l.interest_code=NEW.interest_code
  ) THEN RAISE(ABORT,'legacy event lead mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_explicit_event_match_insert
BEFORE INSERT ON academy_commercial_opportunities
WHEN NEW.consent_evidence_type='explicit_event_interest'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_event_registrations r
    WHERE r.id=NEW.source_instance_ref
      AND r.tenant_id=NEW.tenant_id
      AND r.user_id=NEW.user_id
      AND r.event_id=NEW.source_ref
      AND r.status IN ('registered','attended')
  ) THEN RAISE(ABORT,'explicit event opportunity requires eligible registration') END;
END;
