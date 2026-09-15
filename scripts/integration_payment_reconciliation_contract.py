from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / 'migrations').glob('*.sql'))
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')

# Prove upgrade/backfill from v0.71, not only a fresh database.
for migration in MIGRATIONS:
    if migration.name == '0045_payment_reconciliation_queue.sql':
        break
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-15T18:00:00.000Z'
hash64 = 'a' * 64
conn.execute('''INSERT INTO academy_payment_webhook_receipts
  (id,provider,request_id,data_id,notification_type,signature_ts,body_hash,verified_at,received_at,status,detail_code)
  VALUES ('R_PENDING','mercado_pago','REQ_PENDING','123','payment','1',?,?,?,'verified_pending_resource_fetch','provider_unavailable')''',
  (hash64, now, now))
conn.execute('''INSERT INTO academy_payment_webhook_receipts
  (id,provider,request_id,data_id,notification_type,signature_ts,body_hash,verified_at,received_at,status,detail_code)
  VALUES ('R_DONE','mercado_pago','REQ_DONE','124','payment','1',?,?,?,'processed','payment_confirmed')''',
  (hash64, now, now))

migration_45 = next(m for m in MIGRATIONS if m.name == '0045_payment_reconciliation_queue.sql')
conn.executescript(migration_45.read_text(encoding='utf-8'))

assert conn.execute("SELECT reconcile_state,reconcile_next_attempt_at FROM academy_payment_webhook_receipts WHERE id='R_PENDING'").fetchone() == ('scheduled', now)
assert conn.execute("SELECT reconcile_state,reconcile_next_attempt_at FROM academy_payment_webhook_receipts WHERE id='R_DONE'").fetchone() == ('done', None)

# Claim requires token + timestamp.
try:
    conn.execute("UPDATE academy_payment_webhook_receipts SET reconcile_state='claimed' WHERE id='R_PENDING'")
    raise AssertionError('claim without token/timestamp was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute('''UPDATE academy_payment_webhook_receipts SET
  reconcile_state='claimed',reconcile_claim_token='CLAIM-1',reconcile_claimed_at=?,reconcile_attempts=reconcile_attempts+1
  WHERE id='R_PENDING' ''', (now,))
assert conn.execute("SELECT reconcile_state,reconcile_attempts,reconcile_claim_token FROM academy_payment_webhook_receipts WHERE id='R_PENDING'").fetchone() == ('claimed', 1, 'CLAIM-1')

# Attempts are monotonic and a released claim must clear ownership.
try:
    conn.execute("UPDATE academy_payment_webhook_receipts SET reconcile_attempts=0 WHERE id='R_PENDING'")
    raise AssertionError('reconciliation attempts decreased')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute("UPDATE academy_payment_webhook_receipts SET reconcile_state='scheduled' WHERE id='R_PENDING'")
    raise AssertionError('scheduled receipt retained a claim')
except sqlite3.IntegrityError:
    pass

# Stale claim recovery clears ownership and makes the receipt eligible again.
conn.execute('''UPDATE academy_payment_webhook_receipts SET
  reconcile_state='scheduled',reconcile_claim_token=NULL,reconcile_claimed_at=NULL,reconcile_next_attempt_at=?
  WHERE id='R_PENDING' ''', (now,))
assert conn.execute("SELECT reconcile_state,reconcile_claim_token FROM academy_payment_webhook_receipts WHERE id='R_PENDING'").fetchone() == ('scheduled', None)

eligible = conn.execute('''SELECT id FROM academy_payment_webhook_receipts
  WHERE reconcile_state='scheduled' AND status IN ('verified_pending_resource_fetch','canonical_verified')
    AND reconcile_attempts < 8 AND datetime(reconcile_next_attempt_at)<=datetime(?) ORDER BY id''', (now,)).fetchall()
assert eligible == [('R_PENDING',)]

# Reclaim then dead-letter; dead-letter cannot retain claim ownership.
conn.execute('''UPDATE academy_payment_webhook_receipts SET
  reconcile_state='claimed',reconcile_claim_token='CLAIM-2',reconcile_claimed_at=?,reconcile_attempts=reconcile_attempts+1
  WHERE id='R_PENDING' ''', (now,))
conn.execute('''UPDATE academy_payment_webhook_receipts SET
  reconcile_state='dead_letter',reconcile_claim_token=NULL,reconcile_claimed_at=NULL,reconcile_next_attempt_at=NULL,
  reconcile_last_error='provider_unavailable' WHERE id='R_PENDING' ''')
assert conn.execute("SELECT reconcile_state,reconcile_attempts,reconcile_last_error FROM academy_payment_webhook_receipts WHERE id='R_PENDING'").fetchone() == ('dead_letter', 2, 'provider_unavailable')

# A terminal receipt accidentally left scheduled is never eligible because financial status is also part of the worker predicate.
conn.execute('''INSERT INTO academy_payment_webhook_receipts
  (id,provider,request_id,data_id,notification_type,signature_ts,body_hash,verified_at,received_at,status,detail_code)
  VALUES ('R_TERMINAL','mercado_pago','REQ_TERMINAL','125','payment','1',?,?,?,'failed','canonical_amount_mismatch')''',
  (hash64, now, now))
assert conn.execute("SELECT reconcile_state FROM academy_payment_webhook_receipts WHERE id='R_TERMINAL'").fetchone() == ('scheduled',)
assert conn.execute('''SELECT COUNT(*) FROM academy_payment_webhook_receipts
  WHERE id='R_TERMINAL' AND reconcile_state='scheduled'
    AND status IN ('verified_pending_resource_fetch','canonical_verified')''').fetchone()[0] == 0

conn.close()
print('Payment reconciliation queue integration fixture: PASS')
