from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-15T18:00:00.000Z'
body_hash = 'a' * 64
canonical_hash = 'b' * 64
checkout_id = '11111111-1111-4111-8111-111111111111'

# Minimal valid receipt can exist before tenant/checkout correlation.
conn.execute('''INSERT INTO academy_payment_webhook_receipts
  (id,provider,request_id,notification_id,data_id,notification_type,action,signature_ts,body_hash,verified_at,received_at,status,detail_code)
  VALUES ('R1','mercado_pago','REQ1','N1','123456789','payment','payment.updated','1742505638683',?,?,?,'verified_pending_resource_fetch','awaiting_canonical_resource_fetch')''',
  (body_hash,now,now))

try:
    conn.execute('''INSERT INTO academy_payment_webhook_receipts
      (id,provider,request_id,data_id,notification_type,signature_ts,body_hash,verified_at,received_at,status)
      VALUES ('R_DUP','mercado_pago','REQ1','123456789','payment','1742505638683',?,?,?,'verified_pending_resource_fetch')''',(body_hash,now,now))
    raise AssertionError('duplicate request id was accepted')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''INSERT INTO academy_payment_webhook_receipts
      (id,provider,request_id,data_id,notification_type,signature_ts,body_hash,verified_at,received_at,status)
      VALUES ('R_BAD_HASH','mercado_pago','REQ2','payment-2','payment','1742505638683','short',?,?,'verified_pending_resource_fetch')''',(now,now))
    raise AssertionError('invalid body hash was accepted')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute("UPDATE academy_payment_webhook_receipts SET data_id='tampered' WHERE id='R1'")
    raise AssertionError('verified webhook evidence was mutable')
except sqlite3.IntegrityError:
    pass

# Correlation may only point to a real checkout inside the same tenant.
conn.execute('''INSERT INTO academy_plans
  (id,tenant_id,slug,name,description,audience_type,commercial_mode,status,featured,created_by,created_at,updated_at)
  VALUES ('PLAN','T1','pro','Pro','Plano','individual','priced','draft',0,'ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_plan_prices
  (id,tenant_id,plan_id,billing_interval,price_unit,version,amount_cents,currency,status,created_by,created_at,updated_at)
  VALUES ('PRICE','T1','PLAN','monthly','subscription',1,5990,'BRL','active','ADMIN',?,?)''',(now,now))
conn.execute("UPDATE academy_plans SET status='public',updated_at=? WHERE id='PLAN'",(now,))
conn.execute("INSERT INTO academy_subscriptions (id,tenant_id,user_id,plan_id,price_id,status,created_at,updated_at) VALUES ('SUB','T1','U1','PLAN','PRICE','pending_payment',?,?)",(now,now))
conn.execute('''INSERT INTO academy_checkout_sessions
  (id,tenant_id,user_id,plan_id,price_id,subscription_id,billing_interval,price_unit,price_version,amount_cents,currency,status,created_at,updated_at)
  VALUES (?,'T1','U1','PLAN','PRICE','SUB','monthly','subscription',1,5990,'BRL','created',?,?)''',(checkout_id,now,now))

try:
    conn.execute("UPDATE academy_payment_webhook_receipts SET tenant_id='T2',checkout_session_id=? WHERE id='R1'",(checkout_id,))
    raise AssertionError('cross-tenant checkout correlation was accepted')
except sqlite3.IntegrityError:
    pass

# Canonical snapshot can be written once after provider fetch.
conn.execute('''UPDATE academy_payment_webhook_receipts SET
  status='canonical_verified',tenant_id='T1',checkout_session_id=?,detail_code='canonical_payment_correlated',
  canonical_resource_type='payment',canonical_resource_id='123456789',canonical_status='approved',
  canonical_external_reference=?,canonical_amount_cents=5990,canonical_currency='BRL',canonical_resource_hash=?,
  canonical_fetched_at=?,canonical_occurred_at=?,provider_payment_id='123456789',fetch_attempts=1,last_fetch_at=?
  WHERE id='R1' ''',(checkout_id,checkout_id,canonical_hash,now,now,now))

row = conn.execute('''SELECT status,tenant_id,checkout_session_id,canonical_amount_cents,canonical_currency,fetch_attempts
  FROM academy_payment_webhook_receipts WHERE id='R1' ''').fetchone()
assert row == ('canonical_verified','T1',checkout_id,5990,'BRL',1)

try:
    conn.execute("UPDATE academy_payment_webhook_receipts SET canonical_amount_cents=1 WHERE id='R1'")
    raise AssertionError('canonical provider evidence was mutable')
except sqlite3.IntegrityError:
    pass

# Subscription correlation may be enriched once, then becomes immutable.
conn.execute("UPDATE academy_payment_webhook_receipts SET provider_subscription_id='PREAPPROVAL-1' WHERE id='R1'")
try:
    conn.execute("UPDATE academy_payment_webhook_receipts SET provider_subscription_id='PREAPPROVAL-2' WHERE id='R1'")
    raise AssertionError('provider subscription evidence changed after first correlation')
except sqlite3.IntegrityError:
    pass

# Canonically verified receipts can become processed and terminal.
conn.execute("UPDATE academy_payment_webhook_receipts SET status='processed',detail_code='payment_confirmed' WHERE id='R1'")
try:
    conn.execute("UPDATE academy_payment_webhook_receipts SET status='canonical_verified' WHERE id='R1'")
    raise AssertionError('processed receipt was reopened')
except sqlite3.IntegrityError:
    pass

conn.close()
print('Mercado Pago canonical webhook integration fixture: PASS')
