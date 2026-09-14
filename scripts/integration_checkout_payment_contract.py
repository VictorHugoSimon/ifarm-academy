from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-14T18:00:00.000Z'
period_end = '2026-10-14T18:00:00.000Z'

# Server-owned plan and price snapshots.
for tenant, plan, price, amount in [('T1','PLAN1','PRICE1',5990),('T2','PLAN2','PRICE2',7990)]:
    conn.execute('''INSERT INTO academy_plans
      (id,tenant_id,slug,name,description,audience_type,commercial_mode,status,featured,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,'individual','priced','draft',0,'ADMIN',?,?)''',
      (plan,tenant,plan.lower(),f'Plano {plan}','Plano de teste',now,now))
    conn.execute('''INSERT INTO academy_plan_prices
      (id,tenant_id,plan_id,billing_interval,price_unit,version,amount_cents,currency,status,created_by,created_at,updated_at)
      VALUES (?,?,?,'monthly','subscription',1,?,'BRL','active','ADMIN',?,?)''',(price,tenant,plan,amount,now,now))
    conn.execute("UPDATE academy_plans SET status='public',updated_at=? WHERE id=?",(now,plan))

# Checkout must be backed by a pending subscription with the exact server price.
conn.execute('''INSERT INTO academy_subscriptions
  (id,tenant_id,user_id,plan_id,price_id,status,created_at,updated_at)
  VALUES ('SUB1','T1','U1','PLAN1','PRICE1','pending_payment',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_checkout_sessions
  (id,tenant_id,user_id,plan_id,price_id,subscription_id,billing_interval,price_unit,price_version,amount_cents,currency,status,created_at,updated_at)
  VALUES ('CHK1','T1','U1','PLAN1','PRICE1','SUB1','monthly','subscription',1,5990,'BRL','created',?,?)''',(now,now))
conn.execute("INSERT INTO academy_payment_state (checkout_session_id,tenant_id,status,amount_cents,currency,updated_at) VALUES ('CHK1','T1','pending',5990,'BRL',?)",(now,))

try:
    conn.execute('''INSERT INTO academy_subscriptions
      (id,tenant_id,user_id,plan_id,price_id,status,created_at,updated_at)
      VALUES ('SUBFORGE','T1','U2','PLAN1','PRICE1','pending_payment',?,?)''',(now,now))
    conn.execute('''INSERT INTO academy_checkout_sessions
      (id,tenant_id,user_id,plan_id,price_id,subscription_id,billing_interval,price_unit,price_version,amount_cents,currency,status,created_at,updated_at)
      VALUES ('FORGE','T1','U2','PLAN1','PRICE1','SUBFORGE','monthly','subscription',1,1,'BRL','created',?,?)''',(now,now))
    raise AssertionError('client-forged checkout amount was accepted')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute("UPDATE academy_checkout_sessions SET amount_cents=1 WHERE id='CHK1'")
    raise AssertionError('checkout price snapshot was mutable')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute("UPDATE academy_payment_state SET status='confirmed',confirmed_at=?,updated_at=? WHERE checkout_session_id='CHK1'",(now,now))
    raise AssertionError('payment was confirmed without verified provider event')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''INSERT INTO academy_payment_events
      (id,tenant_id,checkout_session_id,provider,provider_event_id,event_type,amount_cents,currency,payload_hash,verified_at,received_at)
      VALUES ('EVTX','T2','CHK1','mercado_pago','evt-x','confirmed',5990,'BRL',?,?,?)''',('a'*64,now,now))
    raise AssertionError('cross-tenant payment event was accepted')
except sqlite3.IntegrityError:
    pass

# A verified provider event can drive the projected payment state.
conn.execute('''INSERT INTO academy_payment_events
  (id,tenant_id,checkout_session_id,provider,provider_event_id,event_type,provider_payment_id,amount_cents,currency,payload_hash,verified_at,received_at)
  VALUES ('EVT1','T1','CHK1','mercado_pago','evt-1','confirmed','pay-1',5990,'BRL',?,?,?)''',('b'*64,now,now))
conn.execute("UPDATE academy_payment_state SET status='confirmed',provider='mercado_pago',provider_payment_id='pay-1',last_event_id='EVT1',confirmed_at=?,updated_at=? WHERE checkout_session_id='CHK1'",(now,now))
conn.execute("UPDATE academy_checkout_sessions SET status='confirmed',provider='mercado_pago',provider_checkout_id='checkout-1',updated_at=? WHERE id='CHK1'",(now,))

try:
    conn.execute('''INSERT INTO academy_payment_events
      (id,tenant_id,checkout_session_id,provider,provider_event_id,event_type,provider_payment_id,amount_cents,currency,payload_hash,verified_at,received_at)
      VALUES ('EVT_DUP','T1','CHK1','mercado_pago','evt-1','confirmed','pay-1',5990,'BRL',?,?,?)''',('c'*64,now,now))
    raise AssertionError('duplicate provider event was accepted')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''INSERT INTO academy_entitlements
      (id,tenant_id,user_id,source_type,source_id,plan_id,status,activation_evidence_type,activation_reference,starts_at,created_at,updated_at)
      VALUES ('ENT_BAD','T1','U1','subscription','SUB1','PLAN1','active','provider_event','evt-1',?,?,?)''',(now,now,now))
    raise AssertionError('entitlement activated while subscription was still pending')
except sqlite3.IntegrityError:
    pass

# Only after a server/provider-backed subscription activation may access become active.
conn.execute('''UPDATE academy_subscriptions SET status='active',provider='mercado_pago',provider_subscription_id='pay-1',
  activation_reference='provider-event:evt-1',started_at=?,current_period_start=?,current_period_end=?,updated_at=?
  WHERE id='SUB1' ''',(now,now,period_end,now))
conn.execute('''INSERT INTO academy_entitlements
  (id,tenant_id,user_id,source_type,source_id,plan_id,status,activation_evidence_type,activation_reference,starts_at,ends_at,created_at,updated_at)
  VALUES ('ENT1','T1','U1','subscription','SUB1','PLAN1','active','provider_event','evt-1',?,?,?,?)''',(now,period_end,now,now))

state = conn.execute("SELECT status,last_event_id FROM academy_payment_state WHERE checkout_session_id='CHK1'").fetchone()
assert state == ('confirmed','EVT1')
entitlement = conn.execute("SELECT status,activation_reference FROM academy_entitlements WHERE id='ENT1'").fetchone()
assert entitlement == ('active','evt-1')

conn.close()
print('Checkout, payment and entitlement integration fixture: PASS')
