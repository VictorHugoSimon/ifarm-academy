from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / 'migrations'

conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')

for migration in sorted(MIGRATIONS.glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

# Fixed-window bucket: same identity/scope increments inside the same window.
conn.execute('''
INSERT INTO academy_rate_limit_buckets
(bucket_key, route_scope, window_start, request_count, updated_at)
VALUES ('B1', 'write', 1000, 1, '2026-09-03T10:00:00.000Z')
''')
conn.execute('''
INSERT INTO academy_rate_limit_buckets
(bucket_key, route_scope, window_start, request_count, updated_at)
VALUES ('B1', 'write', 1000, 1, '2026-09-03T10:00:01.000Z')
ON CONFLICT(bucket_key) DO UPDATE SET
 route_scope=excluded.route_scope,
 window_start=excluded.window_start,
 request_count=CASE
   WHEN academy_rate_limit_buckets.window_start=excluded.window_start
     THEN academy_rate_limit_buckets.request_count + 1
   ELSE 1
 END,
 updated_at=excluded.updated_at
''')
count_same_window = conn.execute(
    "SELECT request_count FROM academy_rate_limit_buckets WHERE bucket_key='B1'"
).fetchone()[0]
assert count_same_window == 2, count_same_window

# A new minute resets the counter instead of creating an unbounded row per window.
conn.execute('''
INSERT INTO academy_rate_limit_buckets
(bucket_key, route_scope, window_start, request_count, updated_at)
VALUES ('B1', 'write', 61000, 1, '2026-09-03T10:01:00.000Z')
ON CONFLICT(bucket_key) DO UPDATE SET
 route_scope=excluded.route_scope,
 window_start=excluded.window_start,
 request_count=CASE
   WHEN academy_rate_limit_buckets.window_start=excluded.window_start
     THEN academy_rate_limit_buckets.request_count + 1
   ELSE 1
 END,
 updated_at=excluded.updated_at
''')
row = conn.execute(
    "SELECT window_start, request_count FROM academy_rate_limit_buckets WHERE bucket_key='B1'"
).fetchone()
assert row == (61000, 1), row

# Operational events store only constrained operational metadata.
conn.execute('''
INSERT INTO academy_operational_events
(id, request_id, event_type, severity, component, route_scope, status_code, detail_code, metadata_json, created_at)
VALUES ('E1', 'REQ-1', 'rate_limited', 'warning', 'edge_middleware', 'write', 429,
        'request_limit_exceeded', '{"limit":60}', '2026-09-03T10:01:00.000Z')
''')
event = conn.execute('''
SELECT event_type, severity, component, status_code, detail_code
FROM academy_operational_events WHERE id='E1'
''').fetchone()
assert event == ('rate_limited', 'warning', 'edge_middleware', 429, 'request_limit_exceeded'), event

# CHECK constraints reject unsupported event categories/severities.
try:
    conn.execute('''
    INSERT INTO academy_operational_events
    (id, event_type, severity, component, metadata_json, created_at)
    VALUES ('E2', 'unknown_event', 'debug', 'test', '{}', '2026-09-03T10:01:00.000Z')
    ''')
    raise AssertionError('invalid operational event should have failed')
except sqlite3.IntegrityError:
    pass

print('operational hardening contract: PASS')
