PRAGMA foreign_keys = ON;

-- Outbox desacoplada: a Academy registra a intenção de handoff, mas não conhece
-- transporte, credenciais ou contrato concreto do CRM/iFarm Core.
CREATE TABLE IF NOT EXISTS academy_commercial_handoff_outbox (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  destination_system TEXT NOT NULL CHECK(destination_system IN ('ifarm_core','crm','partner','other')),
  event_type TEXT NOT NULL DEFAULT 'commercial.opportunity.ready',
  payload_version INTEGER NOT NULL DEFAULT 1 CHECK(payload_version > 0),
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','delivered','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_attempt_at TEXT,
  delivery_reference TEXT,
  last_error_code TEXT,
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivered_at TEXT,
  FOREIGN KEY (opportunity_id) REFERENCES academy_commercial_opportunities(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_handoff_open_unique
ON academy_commercial_handoff_outbox(tenant_id,opportunity_id,destination_system,event_type)
WHERE status IN ('pending','processing','failed');

CREATE INDEX IF NOT EXISTS idx_commercial_handoff_queue
ON academy_commercial_handoff_outbox(tenant_id,destination_system,status,next_attempt_at,created_at);

CREATE INDEX IF NOT EXISTS idx_commercial_handoff_opportunity
ON academy_commercial_handoff_outbox(tenant_id,opportunity_id,created_at DESC);

-- Evidência de valor atribuído à conversão. Não é contabilidade nem confirmação
-- de receita recebida: apenas um fato comercial referenciado a um sistema fonte.
CREATE TABLE IF NOT EXISTS academy_commercial_conversion_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  evidence_system TEXT NOT NULL CHECK(evidence_system IN (
    'ifarm_core','ifarm_store','ifarm_services','ifarm_finance','ifarm_insurance',
    'crm','payment','contract','order','partner','other'
  )),
  evidence_ref TEXT NOT NULL,
  attributed_value_cents INTEGER CHECK(attributed_value_cents IS NULL OR attributed_value_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  confirmed_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (opportunity_id) REFERENCES academy_commercial_opportunities(id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,opportunity_id,evidence_system,evidence_ref)
);

CREATE INDEX IF NOT EXISTS idx_commercial_conversion_evidence_period
ON academy_commercial_conversion_evidence(tenant_id,confirmed_at,evidence_system);

CREATE TRIGGER IF NOT EXISTS trg_commercial_handoff_insert_guard
BEFORE INSERT ON academy_commercial_handoff_outbox
BEGIN
  SELECT CASE WHEN trim(NEW.event_type)='' OR trim(NEW.payload_json)='' OR trim(NEW.requested_by)=''
    THEN RAISE(ABORT,'commercial handoff required fields missing') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_commercial_opportunities o
    WHERE o.id=NEW.opportunity_id AND o.tenant_id=NEW.tenant_id
      AND o.stage IN ('qualified','contacted','opportunity','converted')
  ) THEN RAISE(ABORT,'commercial handoff requires eligible opportunity in same tenant') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_handoff_update_guard
BEFORE UPDATE ON academy_commercial_handoff_outbox
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.opportunity_id!=OLD.opportunity_id OR
    NEW.destination_system!=OLD.destination_system OR NEW.event_type!=OLD.event_type OR NEW.payload_version!=OLD.payload_version OR
    NEW.payload_json!=OLD.payload_json OR NEW.requested_by!=OLD.requested_by OR NEW.created_at!=OLD.created_at
    THEN RAISE(ABORT,'commercial handoff identity/payload is immutable') END;
  SELECT CASE WHEN NEW.status='delivered' AND (NEW.delivery_reference IS NULL OR trim(NEW.delivery_reference)='' OR NEW.delivered_at IS NULL)
    THEN RAISE(ABORT,'delivered handoff requires delivery reference and timestamp') END;
  SELECT CASE WHEN NEW.status='failed' AND (NEW.last_error_code IS NULL OR trim(NEW.last_error_code)='')
    THEN RAISE(ABORT,'failed handoff requires error code') END;
  SELECT CASE WHEN OLD.status='delivered' AND NEW.status!='delivered'
    THEN RAISE(ABORT,'delivered handoff is terminal') END;
  SELECT CASE WHEN OLD.status='cancelled' AND NEW.status!='cancelled'
    THEN RAISE(ABORT,'cancelled handoff is terminal') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_conversion_evidence_insert_guard
BEFORE INSERT ON academy_commercial_conversion_evidence
BEGIN
  SELECT CASE WHEN trim(NEW.evidence_ref)='' OR trim(NEW.currency)='' OR trim(NEW.recorded_by)=''
    THEN RAISE(ABORT,'commercial conversion evidence required fields missing') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_commercial_opportunities o
    WHERE o.id=NEW.opportunity_id AND o.tenant_id=NEW.tenant_id
      AND o.stage='converted' AND o.conversion_ref IS NOT NULL
  ) THEN RAISE(ABORT,'conversion evidence requires converted opportunity in same tenant') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_conversion_evidence_immutable
BEFORE UPDATE ON academy_commercial_conversion_evidence
BEGIN
  SELECT RAISE(ABORT,'commercial conversion evidence is immutable; append a new evidence record');
END;
