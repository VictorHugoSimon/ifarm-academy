PRAGMA foreign_keys = ON;

CREATE TRIGGER IF NOT EXISTS trg_commercial_active_rule_immutable
BEFORE UPDATE ON academy_commercial_offer_rules
WHEN OLD.status='active'
BEGIN
  SELECT CASE WHEN
    NEW.interest_code!=OLD.interest_code OR
    NEW.offer_system!=OLD.offer_system OR
    NEW.offer_ref!=OLD.offer_ref OR
    NEW.offer_label!=OLD.offer_label OR
    NEW.offer_description!=OLD.offer_description OR
    NEW.cta_label!=OLD.cta_label OR
    NEW.consent_purpose!=OLD.consent_purpose OR
    NEW.consent_text!=OLD.consent_text OR
    NEW.consent_version!=OLD.consent_version OR
    NEW.priority!=OLD.priority OR
    NEW.active_from IS NOT OLD.active_from OR
    NEW.active_until IS NOT OLD.active_until OR
    NEW.created_by!=OLD.created_by OR
    NEW.created_at!=OLD.created_at
  THEN RAISE(ABORT,'active commercial rule is immutable; archive and create a new version') END;
  SELECT CASE WHEN NEW.status='draft'
    THEN RAISE(ABORT,'active commercial rule cannot return to draft') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_opportunity_offer_snapshot_immutable
BEFORE UPDATE ON academy_commercial_opportunities
BEGIN
  SELECT CASE WHEN
    NEW.interest_code!=OLD.interest_code OR
    NEW.offer_system IS NOT OLD.offer_system OR
    NEW.offer_ref IS NOT OLD.offer_ref OR
    NEW.offer_label_snapshot IS NOT OLD.offer_label_snapshot OR
    NEW.legacy_event_lead_id IS NOT OLD.legacy_event_lead_id OR
    NEW.source_instance_ref IS NOT OLD.source_instance_ref
  THEN RAISE(ABORT,'commercial opportunity offer/source snapshot is immutable') END;
END;
