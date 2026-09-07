PRAGMA foreign_keys = ON;

-- Preferência global de contato comercial da Academy. É append-only para preservar
-- o histórico: "resume" remove apenas o bloqueio global e não recria consentimentos.
CREATE TABLE IF NOT EXISTS academy_commercial_contact_preference_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('suppress_all','resume')),
  source TEXT NOT NULL CHECK(source IN ('self_service','admin_privacy_request')),
  reason TEXT,
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commercial_contact_pref_latest
ON academy_commercial_contact_preference_events(tenant_id,user_id,created_at DESC,id DESC);

-- Estado de consentimento por oportunidade. O consentimento original permanece no
-- snapshot da oportunidade; revogações/reautorizações são novos eventos imutáveis.
CREATE TABLE IF NOT EXISTS academy_commercial_opportunity_consent_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('revoked','regranted')),
  source TEXT NOT NULL CHECK(source IN ('self_service','admin_privacy_request')),
  consent_version TEXT,
  reason TEXT,
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (opportunity_id) REFERENCES academy_commercial_opportunities(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_commercial_opportunity_consent_latest
ON academy_commercial_opportunity_consent_events(tenant_id,opportunity_id,created_at DESC,id DESC);

CREATE INDEX IF NOT EXISTS idx_commercial_opportunity_consent_user
ON academy_commercial_opportunity_consent_events(tenant_id,user_id,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_commercial_contact_pref_insert_guard
BEFORE INSERT ON academy_commercial_contact_preference_events
BEGIN
  SELECT CASE WHEN trim(NEW.user_id)='' OR trim(NEW.recorded_by)=''
    THEN RAISE(ABORT,'commercial contact preference required fields missing') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_contact_pref_immutable
BEFORE UPDATE ON academy_commercial_contact_preference_events
BEGIN
  SELECT RAISE(ABORT,'commercial contact preference events are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_opportunity_consent_insert_guard
BEFORE INSERT ON academy_commercial_opportunity_consent_events
BEGIN
  SELECT CASE WHEN trim(NEW.user_id)='' OR trim(NEW.recorded_by)=''
    THEN RAISE(ABORT,'commercial consent event required fields missing') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_commercial_opportunities o
    WHERE o.id=NEW.opportunity_id AND o.tenant_id=NEW.tenant_id AND o.user_id=NEW.user_id
  ) THEN RAISE(ABORT,'commercial consent event opportunity/user mismatch') END;

  SELECT CASE WHEN NEW.action='regranted' AND (
    SELECT action FROM academy_commercial_contact_preference_events p
    WHERE p.tenant_id=NEW.tenant_id AND p.user_id=NEW.user_id
    ORDER BY p.created_at DESC,p.id DESC LIMIT 1
  )='suppress_all' THEN RAISE(ABORT,'commercial regrant blocked by global suppression') END;

  SELECT CASE WHEN NEW.action='regranted' AND (
    NEW.consent_version IS NULL OR trim(NEW.consent_version)='' OR NOT EXISTS (
      SELECT 1
      FROM academy_commercial_opportunities o
      JOIN academy_commercial_offer_rules r
        ON r.id=o.rule_id AND r.tenant_id=o.tenant_id
      WHERE o.id=NEW.opportunity_id AND o.tenant_id=NEW.tenant_id AND o.user_id=NEW.user_id
        AND o.consent_evidence_type='explicit_rule_opt_in'
        AND r.status='active' AND r.consent_version=NEW.consent_version
    )
  ) THEN RAISE(ABORT,'commercial regrant requires active explicit rule and current consent version') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_opportunity_consent_immutable
BEFORE UPDATE ON academy_commercial_opportunity_consent_events
BEGIN
  SELECT RAISE(ABORT,'commercial consent state events are immutable');
END;

-- Um bloqueio global impede a criação de novas oportunidades comerciais, mesmo que
-- um fluxo antigo tente contornar a API. O usuário precisa primeiro reabrir contato.
CREATE TRIGGER IF NOT EXISTS trg_commercial_opportunity_global_suppression_guard
BEFORE INSERT ON academy_commercial_opportunities
WHEN (
  SELECT action FROM academy_commercial_contact_preference_events p
  WHERE p.tenant_id=NEW.tenant_id AND p.user_id=NEW.user_id
  ORDER BY p.created_at DESC,p.id DESC LIMIT 1
)='suppress_all'
BEGIN
  SELECT RAISE(ABORT,'commercial opportunity blocked by global suppression');
END;

-- Handoffs novos e retomadas/entregas só são permitidos quando o consentimento
-- efetivo permanece válido. Registros já entregues continuam como evidência histórica.
CREATE TRIGGER IF NOT EXISTS trg_commercial_handoff_consent_insert_guard
BEFORE INSERT ON academy_commercial_handoff_outbox
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM academy_commercial_opportunities o
    WHERE o.id=NEW.opportunity_id AND o.tenant_id=NEW.tenant_id
      AND (
        (SELECT action FROM academy_commercial_contact_preference_events p
          WHERE p.tenant_id=o.tenant_id AND p.user_id=o.user_id
          ORDER BY p.created_at DESC,p.id DESC LIMIT 1)='suppress_all'
        OR
        (SELECT action FROM academy_commercial_opportunity_consent_events ce
          WHERE ce.tenant_id=o.tenant_id AND ce.opportunity_id=o.id AND ce.user_id=o.user_id
          ORDER BY ce.created_at DESC,ce.id DESC LIMIT 1)='revoked'
      )
  ) THEN RAISE(ABORT,'commercial handoff blocked by consent state') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_handoff_consent_update_guard
BEFORE UPDATE ON academy_commercial_handoff_outbox
WHEN NEW.status IN ('pending','processing','delivered') AND NEW.status!=OLD.status
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM academy_commercial_opportunities o
    WHERE o.id=NEW.opportunity_id AND o.tenant_id=NEW.tenant_id
      AND (
        (SELECT action FROM academy_commercial_contact_preference_events p
          WHERE p.tenant_id=o.tenant_id AND p.user_id=o.user_id
          ORDER BY p.created_at DESC,p.id DESC LIMIT 1)='suppress_all'
        OR
        (SELECT action FROM academy_commercial_opportunity_consent_events ce
          WHERE ce.tenant_id=o.tenant_id AND ce.opportunity_id=o.id AND ce.user_id=o.user_id
          ORDER BY ce.created_at DESC,ce.id DESC LIMIT 1)='revoked'
      )
  ) THEN RAISE(ABORT,'commercial handoff transition blocked by consent state') END;
END;
