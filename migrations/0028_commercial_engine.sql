PRAGMA foreign_keys = ON;

-- Regras de recomendação são configuradas explicitamente. Nenhuma regra é inferida
-- automaticamente a partir de comportamento, nota, presença ou dados técnicos.
CREATE TABLE IF NOT EXISTS academy_commercial_offer_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('course_completion','certificate_issued','event','learning_path','plan')),
  source_ref TEXT NOT NULL,
  interest_code TEXT NOT NULL,
  offer_system TEXT NOT NULL CHECK(offer_system IN ('ifarm_core','ifarm_store','ifarm_services','ifarm_finance','ifarm_insurance','academy','partner','other')),
  offer_ref TEXT NOT NULL,
  offer_label TEXT NOT NULL,
  offer_description TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT 'Tenho interesse',
  consent_purpose TEXT NOT NULL,
  consent_text TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100 CHECK(priority >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
  active_from TEXT,
  active_until TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id,source_type,source_ref,offer_system,offer_ref,consent_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_rule_active_offer
ON academy_commercial_offer_rules(tenant_id,source_type,source_ref,offer_system,offer_ref)
WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_commercial_rule_source
ON academy_commercial_offer_rules(tenant_id,source_type,source_ref,status,priority);

-- Oportunidade comercial canônica. Não duplica cadastro de pessoa: identidade vem do
-- iFarm/user_id já autenticado. Dados de contato devem permanecer no sistema de identidade/CRM.
CREATE TABLE IF NOT EXISTS academy_commercial_opportunities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  company_id TEXT,
  source_type TEXT NOT NULL CHECK(source_type IN ('course_completion','certificate_issued','event','learning_path','plan')),
  source_ref TEXT NOT NULL,
  source_instance_ref TEXT,
  rule_id TEXT,
  legacy_event_lead_id TEXT,
  interest_code TEXT NOT NULL,
  offer_system TEXT,
  offer_ref TEXT,
  offer_label_snapshot TEXT,
  consent_evidence_type TEXT NOT NULL CHECK(consent_evidence_type IN ('explicit_rule_opt_in','explicit_event_interest','legacy_event_interest')),
  consent_source TEXT NOT NULL,
  consent_purpose_snapshot TEXT,
  consent_text_snapshot TEXT,
  consent_version TEXT,
  consent_recorded_at TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN ('new','qualified','contacted','opportunity','converted','discarded')),
  assigned_to_user_id TEXT,
  conversion_ref TEXT,
  converted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (rule_id) REFERENCES academy_commercial_offer_rules(id) ON DELETE RESTRICT,
  FOREIGN KEY (legacy_event_lead_id) REFERENCES academy_event_commercial_leads(id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,legacy_event_lead_id),
  UNIQUE (tenant_id,user_id,source_type,source_ref,rule_id)
);

CREATE INDEX IF NOT EXISTS idx_commercial_opportunity_pipeline
ON academy_commercial_opportunities(tenant_id,stage,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commercial_opportunity_user
ON academy_commercial_opportunities(tenant_id,user_id,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commercial_opportunity_source
ON academy_commercial_opportunities(tenant_id,source_type,source_ref,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_commercial_rule_insert_guard
BEFORE INSERT ON academy_commercial_offer_rules
BEGIN
  SELECT CASE WHEN trim(NEW.source_ref)='' OR trim(NEW.interest_code)='' OR trim(NEW.offer_ref)='' OR trim(NEW.offer_label)=''
    THEN RAISE(ABORT,'commercial rule required fields missing') END;
  SELECT CASE WHEN trim(NEW.consent_purpose)='' OR trim(NEW.consent_text)='' OR trim(NEW.consent_version)=''
    THEN RAISE(ABORT,'commercial rule requires explicit consent snapshot') END;
  SELECT CASE WHEN NEW.active_from IS NOT NULL AND NEW.active_until IS NOT NULL AND datetime(NEW.active_until)<=datetime(NEW.active_from)
    THEN RAISE(ABORT,'commercial rule validity window invalid') END;

  SELECT CASE WHEN NEW.source_type IN ('course_completion','certificate_issued') AND NOT EXISTS (
    SELECT 1 FROM academy_courses c WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.source_ref
  ) THEN RAISE(ABORT,'commercial rule course source mismatch') END;

  SELECT CASE WHEN NEW.source_type='event' AND NOT EXISTS (
    SELECT 1 FROM academy_events e WHERE e.tenant_id=NEW.tenant_id AND e.id=NEW.source_ref
  ) THEN RAISE(ABORT,'commercial rule event source mismatch') END;

  SELECT CASE WHEN NEW.source_type='learning_path' AND NOT EXISTS (
    SELECT 1 FROM academy_public_learning_paths p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.source_ref
  ) THEN RAISE(ABORT,'commercial rule path source mismatch') END;

  SELECT CASE WHEN NEW.source_type='plan' AND NOT EXISTS (
    SELECT 1 FROM academy_plans p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.source_ref
  ) THEN RAISE(ABORT,'commercial rule plan source mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_rule_identity_update
BEFORE UPDATE ON academy_commercial_offer_rules
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.source_type!=OLD.source_type OR NEW.source_ref!=OLD.source_ref
    THEN RAISE(ABORT,'commercial rule identity/source is immutable') END;
  SELECT CASE WHEN OLD.status='archived' AND NEW.status!='archived'
    THEN RAISE(ABORT,'archived commercial rule cannot be reactivated') END;
  SELECT CASE WHEN NEW.active_from IS NOT NULL AND NEW.active_until IS NOT NULL AND datetime(NEW.active_until)<=datetime(NEW.active_from)
    THEN RAISE(ABORT,'commercial rule validity window invalid') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_opportunity_insert_guard
BEFORE INSERT ON academy_commercial_opportunities
BEGIN
  SELECT CASE WHEN trim(NEW.user_id)='' OR trim(NEW.source_ref)='' OR trim(NEW.interest_code)='' OR trim(NEW.consent_source)=''
    THEN RAISE(ABORT,'commercial opportunity required fields missing') END;

  SELECT CASE WHEN NEW.consent_evidence_type='explicit_rule_opt_in' AND (
    NEW.rule_id IS NULL OR NEW.offer_system IS NULL OR NEW.offer_ref IS NULL OR NEW.offer_label_snapshot IS NULL OR
    NEW.consent_purpose_snapshot IS NULL OR NEW.consent_text_snapshot IS NULL OR NEW.consent_version IS NULL
  ) THEN RAISE(ABORT,'explicit commercial opt-in requires rule and consent snapshot') END;

  SELECT CASE WHEN NEW.consent_evidence_type='explicit_rule_opt_in' AND NOT EXISTS (
    SELECT 1 FROM academy_commercial_offer_rules r
    WHERE r.id=NEW.rule_id AND r.tenant_id=NEW.tenant_id AND r.source_type=NEW.source_type AND r.source_ref=NEW.source_ref
      AND r.status='active'
  ) THEN RAISE(ABORT,'commercial opportunity rule mismatch') END;

  SELECT CASE WHEN NEW.consent_evidence_type='legacy_event_interest' AND NEW.legacy_event_lead_id IS NULL
    THEN RAISE(ABORT,'legacy commercial opportunity requires legacy event lead') END;

  SELECT CASE WHEN NEW.consent_evidence_type='explicit_event_interest' AND (
    NEW.source_type!='event' OR NEW.consent_purpose_snapshot IS NULL OR NEW.consent_text_snapshot IS NULL OR NEW.consent_version IS NULL
  ) THEN RAISE(ABORT,'event opt-in requires explicit consent snapshot') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_opportunity_identity_update
BEFORE UPDATE ON academy_commercial_opportunities
BEGIN
  SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.user_id!=OLD.user_id OR NEW.source_type!=OLD.source_type OR NEW.source_ref!=OLD.source_ref OR NEW.rule_id IS NOT OLD.rule_id
    THEN RAISE(ABORT,'commercial opportunity identity/source is immutable') END;
  SELECT CASE WHEN NEW.consent_evidence_type!=OLD.consent_evidence_type OR NEW.consent_source!=OLD.consent_source OR NEW.consent_recorded_at!=OLD.consent_recorded_at OR
    NEW.consent_purpose_snapshot IS NOT OLD.consent_purpose_snapshot OR NEW.consent_text_snapshot IS NOT OLD.consent_text_snapshot OR NEW.consent_version IS NOT OLD.consent_version
    THEN RAISE(ABORT,'commercial opportunity consent evidence is immutable') END;
  SELECT CASE WHEN NEW.stage='converted' AND (NEW.conversion_ref IS NULL OR NEW.converted_at IS NULL)
    THEN RAISE(ABORT,'converted opportunity requires conversion reference and timestamp') END;
  SELECT CASE WHEN OLD.stage='converted' AND NEW.stage!='converted'
    THEN RAISE(ABORT,'converted opportunity cannot leave converted stage') END;
END;

-- Preserva oportunidades de Smart Farm já existentes. Não inventamos o texto histórico
-- de consentimento: o registro legado é referenciado como evidência e os snapshots ficam nulos.
INSERT OR IGNORE INTO academy_commercial_opportunities (
  id,tenant_id,user_id,company_id,source_type,source_ref,source_instance_ref,rule_id,legacy_event_lead_id,
  interest_code,offer_system,offer_ref,offer_label_snapshot,consent_evidence_type,consent_source,
  consent_purpose_snapshot,consent_text_snapshot,consent_version,consent_recorded_at,stage,
  conversion_ref,converted_at,created_at,updated_at
)
SELECT
  'legacy-event:' || l.id,l.tenant_id,l.user_id,l.company_id,'event',l.event_id,l.registration_id,NULL,l.id,
  l.interest_code,NULL,NULL,NULL,'legacy_event_interest',l.consent_source,
  NULL,NULL,NULL,l.consent_recorded_at,l.stage,
  CASE WHEN l.stage='converted' THEN 'legacy-event:' || l.id ELSE NULL END,
  CASE WHEN l.stage='converted' THEN l.updated_at ELSE NULL END,
  l.created_at,l.updated_at
FROM academy_event_commercial_leads l;
