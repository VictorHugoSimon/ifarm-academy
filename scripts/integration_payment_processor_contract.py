from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-14T18:00:00.000Z'
period_end = '2026-10-14T18:00:00.000Z'

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
  VALUES ('CHK','T1','U1','PLAN','PRICE','SUB','monthly','subscription',1,5990,'BRL','pending',?,?)''',(now,now))
conn.execute("INSERT INTO academy_payment_state (checkout_session_id,tenant_id,status,amount_cents,currency,updated_at) VALUES ('CHK','T1','pending',5990,'BRL',?)",(now,))

# Confirmation without provider subscription/canonical timing evidence is rejected at the database boundary.
try:
    conn.execute('''INSERT INTO academy_payment_events
      (id,tenant_id,checkout_session_id,provider,provider_event_id,event_type,provider_payment_id,amount_cents,currency,payload_hash,verified_at,received_at)
      VALUES ('BAD','T1','CHK','mercado_pago','evt-bad','confirmed','pay-bad',5990,'BRL',?,?,?)''',('a'*64,now,now))
    raise AssertionError('confirmed event without subscription/timing evidence was accepted')
except sqlite3.IntegrityError:
    pass

# Simulate the verified-event processor: provider supplies payment/subscription + occurrence only.
conn.execute('''INSERT INTO academy_payment_events
  (id,tenant_id,checkout_session_id,provider,provider_event_id,event_type,provider_payment_id,provider_subscription_id,amount_cents,currency,payload_hash,verified_at,received_at,provider_occurred_at,processing_status)
  VALUES ('EVT1','T1','CHK','mercado_pago','evt-1','confirmed','pay-1','sub-1',5990,'BRL',?,?,?,?, 'received')''',('b'*64,now,now,now))
conn.execute('''INSERT INTO academy_subscription_billing_periods
  (id,tenant_id,subscription_id,checkout_session_id,payment_event_id,provider,provider_event_id,provider_payment_id,
   provider_subscription_id,billing_interval,period_start,period_end,period_start_source,period_end_source,
   provider_period_end_matches,derivation_version,derived_at)
  VALUES ('BP1','T1','SUB','CHK','EVT1','mercado_pago','evt-1','pay-1','sub-1','monthly',?,?,'provider_occurred_at',
          'academy_derived_from_checkout_interval',NULL,1,?)''',(now,period_end,now))
conn.execute("UPDATE academy_payment_state SET status='confirmed',provider='mercado_pago',provider_payment_id='pay-1',last_event_id='EVT1',confirmed_at=?,updated_at=? WHERE checkout_session_id='CHK'",(now,now))
conn.execute("UPDATE academy_checkout_sessions SET status='confirmed',provider='mercado_pago',updated_at=? WHERE id='CHK'",(now,))
conn.execute('''UPDATE academy_subscriptions SET status='active',provider='mercado_pago',provider_subscription_id='sub-1',
  activation_reference='verified-provider-event:mercado_pago:evt-1',started_at=?,current_period_start=?,current_period_end=?,updated_at=? WHERE id='SUB' ''',(now,now,period_end,now))
conn.execute('''INSERT INTO academy_entitlements
  (id,tenant_id,user_id,source_type,source_id,plan_id,status,activation_evidence_type,activation_reference,starts_at,ends_at,created_at,updated_at)
  VALUES ('ENT','T1','U1','subscription','SUB','PLAN','active','verified_provider_event','verified-provider-event:mercado_pago:evt-1',?,?,?,?)''',(now,period_end,now,now))
conn.execute("UPDATE academy_payment_events SET processing_status='processed',processed_at=? WHERE id='EVT1'",(now,))
conn.execute("INSERT INTO academy_payment_processing_log (id,tenant_id,checkout_session_id,payment_event_id,outcome,detail_code,created_at) VALUES ('LOG1','T1','CHK','EVT1','applied','payment_confirmed',?)",(now,))

# Verified event evidence cannot be rewritten after processing.
try:
    conn.execute("UPDATE academy_payment_events SET provider_subscription_id='sub-other' WHERE id='EVT1'")
    raise AssertionError('verified event evidence was mutated')
except sqlite3.IntegrityError:
    pass

# Refund updates financial state but deliberately does not revoke access while refund policy is TBD.
conn.execute('''INSERT INTO academy_payment_events
  (id,tenant_id,checkout_session_id,provider,provider_event_id,event_type,provider_payment_id,amount_cents,currency,payload_hash,verified_at,received_at,processing_status)
  VALUES ('EVT2','T1','CHK','mercado_pago','evt-refund','refunded','pay-1',5990,'BRL',?,?,?,'received')''',('c'*64,now,now))
conn.execute("UPDATE academy_payment_state SET status='refunded',last_event_id='EVT2',updated_at=? WHERE checkout_session_id='CHK'",(now,))
conn.execute("UPDATE academy_payment_events SET processing_status='processed',processed_at=? WHERE id='EVT2'",(now,))
conn.execute("INSERT INTO academy_payment_processing_log (id,tenant_id,checkout_session_id,payment_event_id,outcome,detail_code,created_at) VALUES ('LOG2','T1','CHK','EVT2','applied','payment_refunded',?)",(now,))

assert conn.execute("SELECT status FROM academy_payment_state WHERE checkout_session_id='CHK'").fetchone() == ('refunded',)
assert conn.execute("SELECT status FROM academy_subscriptions WHERE id='SUB'").fetchone() == ('active',)
assert conn.execute("SELECT status FROM academy_entitlements WHERE id='ENT'").fetchone() == ('active',)
assert conn.execute("SELECT period_end_source FROM academy_subscription_billing_periods WHERE subscription_id='SUB'").fetchone() == ('academy_derived_from_checkout_interval',)
assert conn.execute("SELECT COUNT(*) FROM academy_payment_processing_log WHERE checkout_session_id='CHK'").fetchone() == (2,)

conn.close()
print('Verified payment processor integration fixture: PASS')
