PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_checkout_provider_sessions (
  checkout_session_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider='mercado_pago'),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requesting' CHECK(status IN ('requesting','created','failed')),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK(attempt_count > 0),
  provider_resource_id TEXT,
  provider_checkout_url TEXT,
  provider_status TEXT,
  response_hash TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, provider, idempotency_key),
  UNIQUE (tenant_id, provider, provider_resource_id),
  FOREIGN KEY (checkout_session_id) REFERENCES academy_checkout_sessions(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_checkout_provider_status
ON academy_checkout_provider_sessions(tenant_id,status,updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_checkout_provider_insert_guard
BEFORE INSERT ON academy_checkout_provider_sessions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_checkout_sessions c
    WHERE c.id=NEW.checkout_session_id AND c.tenant_id=NEW.tenant_id
      AND c.status IN ('created','awaiting_provider','pending')
  ) THEN RAISE(ABORT,'provider checkout requires an open local checkout in the same tenant') END;
  SELECT CASE WHEN length(trim(NEW.idempotency_key))=0 OR length(NEW.request_hash)!=64
    THEN RAISE(ABORT,'provider checkout requires idempotency key and request hash') END;
  SELECT CASE WHEN NEW.status='created' AND (
    NEW.provider_resource_id IS NULL OR NEW.provider_checkout_url IS NULL OR NEW.response_hash IS NULL
    OR length(NEW.response_hash)!=64 OR substr(NEW.provider_checkout_url,1,8)!='https://'
  ) THEN RAISE(ABORT,'created provider checkout requires verified provider response') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_checkout_provider_update_guard
BEFORE UPDATE ON academy_checkout_provider_sessions
BEGIN
  SELECT CASE WHEN NEW.checkout_session_id!=OLD.checkout_session_id OR NEW.tenant_id!=OLD.tenant_id
    OR NEW.provider!=OLD.provider OR NEW.idempotency_key!=OLD.idempotency_key
    OR NEW.request_hash!=OLD.request_hash OR NEW.created_at!=OLD.created_at
    THEN RAISE(ABORT,'provider checkout identity/request is immutable') END;
  SELECT CASE WHEN OLD.status='created' AND (
    NEW.status!='created' OR NEW.provider_resource_id IS NOT OLD.provider_resource_id
    OR NEW.provider_checkout_url IS NOT OLD.provider_checkout_url
    OR NEW.response_hash IS NOT OLD.response_hash
  ) THEN RAISE(ABORT,'created provider checkout is immutable') END;
  SELECT CASE WHEN NEW.attempt_count<OLD.attempt_count
    THEN RAISE(ABORT,'provider checkout attempt count cannot decrease') END;
  SELECT CASE WHEN NEW.status='created' AND (
    NEW.provider_resource_id IS NULL OR NEW.provider_checkout_url IS NULL OR NEW.response_hash IS NULL
    OR length(NEW.response_hash)!=64 OR substr(NEW.provider_checkout_url,1,8)!='https://'
  ) THEN RAISE(ABORT,'created provider checkout requires verified provider response') END;
END;
