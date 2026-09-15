from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-15T18:00:00.000Z'
conn.execute('''INSERT INTO academy_plans
  (id,tenant_id,slug,name,description,audience_type,commercial_mode,status,featured,created_by,created_at,updated_at)
  VALUES ('PLAN','T1','pro','Plano Pro','Plano','individual','priced','draft',0,'ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_plan_prices
  (id,tenant_id,plan_id,billing_interval,price_unit,version,amount_cents,currency,status,created_by,created_at,updated_at)
  VALUES ('PRICE','T1','PLAN','monthly','subscription',1,5990,'BRL','active','ADMIN',?,?)''',(now,now))
conn.execute("UPDATE academy_plans SET status='public',updated_at=? WHERE id='PLAN'",(now,))
conn.execute('''INSERT INTO academy_subscriptions
  (id,tenant_id,user_id,plan_id,price_id,status,created_at,updated_at)
  VALUES ('SUB','T1','U1','PLAN','PRICE','pending_payment',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_checkout_sessions
  (id,tenant_id,user_id,plan_id,price_id,subscription_id,billing_interval,price_unit,price_version,amount_cents,currency,status,created_at,updated_at)
  VALUES ('11111111-1111-4111-8111-111111111111','T1','U1','PLAN','PRICE','SUB','monthly','subscription',1,5990,'BRL','created',?,?)''',(now,now))
conn.execute("INSERT INTO academy_payment_state (checkout_session_id,tenant_id,status,amount_cents,currency,updated_at) VALUES ('11111111-1111-4111-8111-111111111111','T1','pending',5990,'BRL',?)",(now,))

checkout_id = '11111111-1111-4111-8111-111111111111'
request_hash = 'a' * 64
response_hash = 'b' * 64
url = 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=mp-1'

conn.execute('''INSERT INTO academy_checkout_provider_sessions
  (checkout_session_id,tenant_id,provider,idempotency_key,request_hash,status,attempt_count,created_at,updated_at)
  VALUES (?,'T1','mercado_pago',?,?,'requesting',1,?,?)''',(checkout_id,checkout_id,request_hash,now,now))
conn.execute('''UPDATE academy_checkout_provider_sessions SET status='created',provider_resource_id='mp-1',
  provider_checkout_url=?,provider_status='pending',response_hash=?,updated_at=? WHERE checkout_session_id=?''',
  (url,response_hash,now,checkout_id))

try:
    conn.execute("UPDATE academy_checkout_provider_sessions SET request_hash=? WHERE checkout_session_id=?",('c'*64,checkout_id))
    raise AssertionError('provider checkout request snapshot was mutable')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute("UPDATE academy_checkout_provider_sessions SET provider_resource_id='mp-forged' WHERE checkout_session_id=?",(checkout_id,))
    raise AssertionError('created provider resource was mutable')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''INSERT INTO academy_checkout_provider_sessions
      (checkout_session_id,tenant_id,provider,idempotency_key,request_hash,status,attempt_count,created_at,updated_at)
      VALUES ('missing','T2','mercado_pago','22222222-2222-4222-8222-222222222222',?,'requesting',1,?,?)''',
      ('d'*64,now,now))
    raise AssertionError('cross-tenant/missing checkout provider session was accepted')
except sqlite3.IntegrityError:
    pass

row = conn.execute('''SELECT status,provider_resource_id,provider_checkout_url,attempt_count
  FROM academy_checkout_provider_sessions WHERE checkout_session_id=?''',(checkout_id,)).fetchone()
assert row == ('created','mp-1',url,1)

conn.close()
print('Checkout provider integration fixture: PASS')
