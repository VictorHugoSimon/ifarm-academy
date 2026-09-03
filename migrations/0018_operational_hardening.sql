PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  route_scope TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK(request_count >= 0),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academy_rate_limit_window
ON academy_rate_limit_buckets(window_start, route_scope);

CREATE TABLE IF NOT EXISTS academy_operational_events (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'rate_limited',
    'readiness_failed',
    'dependency_unavailable',
    'security_boundary_failure',
    'maintenance'
  )),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('info','warning','error','critical')),
  component TEXT NOT NULL,
  route_scope TEXT,
  status_code INTEGER,
  detail_code TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academy_operational_events_created
ON academy_operational_events(created_at DESC, severity, event_type);

CREATE INDEX IF NOT EXISTS idx_academy_operational_events_request
ON academy_operational_events(request_id)
WHERE request_id IS NOT NULL;
