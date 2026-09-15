from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-14T18:00:00.000Z'
body_hash = 'a' * 64

# Minimal valid receipt can exist before tenant/checkout correlation.
conn.execute('''INSERT INTO academy_payment_webhook_receipts
  (id,provider,request_id,notification_id,data_id,notification_type,action,signature_ts,body_hash,verified_at,received_at,status,detail_code)
  VALUES ('R1','mercado_pago','REQ1','N1','payment-1','payment','payment.updated','1742505638683',?,?,?,'verified_pending_resource_fetch','awaiting_canonical_resource_fetch')''',
  (body_hash,now,now))

try:
    conn.execute('''INSERT INTO academy_payment_webhook_receipts
      (id,provider,request_id,data_id,notification_type,signature_ts,body_hash,verified_at,received_at,status)
      VALUES ('R_DUP','mercado_pago','REQ1','payment-1','payment','1742505638683',?,?,?,'verified_pending_resource_fetch')''',(body_hash,now,now))
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
  VALUES ('CHK','T1','U1','PLAN','PRICE','SUB','monthly','subscription',1,5990,'BRL','created',?,?)''',(now,now))

try:
    conn.execute("UPDATE academy_payment_webhook_receipts SET tenant_id='T2',checkout_session_id='CHK' WHERE id='R1'")
    raise AssertionError('cross-tenant checkout correlation was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute("UPDATE academy_payment_webhook_receipts SET tenant_id='T1',checkout_session_id='CHK',detail_code='correlated' WHERE id='R1'")
assert conn.execute("SELECT tenant_id,checkout_session_id FROM academy_payment_webhook_receipts WHERE id='R1'").fetchone() == ('T1','CHK')

conn.close()
print('Mercado Pago webhook receipt integration fixture: PASS')
