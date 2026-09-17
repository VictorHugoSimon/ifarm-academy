from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2027-01-31T18:00:00.000Z'
period_end = '2027-02-28T18:00:00.000Z'

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

# Provider confirms payment and supplies canonical occurrence, but no provider period_end.
conn.execute('''INSERT INTO academy_payment_events
  (id,tenant_id,checkout_session_id,provider,provider_event_id,event_type,provider_payment_id,provider_subscription_id,
   amount_cents,currency,payload_hash,verified_at,received_at,provider_occurred_at,processing_status)
  VALUES ('EVT','T1','CHK','mercado_pago','evt-1','confirmed','pay-1','sub-1',5990,'BRL',?,?,?,?, 'received')''',
  ('a'*64,now,now,now))

# Database accepts the provider event without pretending Mercado Pago returned a period_end.
event = conn.execute("SELECT provider_occurred_at,period_start,period_end FROM academy_payment_events WHERE id='EVT'").fetchone()
assert event == (now,None,None)

# Academy materializes the locally-derived period using the immutable monthly checkout cadence.
conn.execute('''INSERT INTO academy_subscription_billing_periods
  (id,tenant_id,subscription_id,checkout_session_id,payment_event_id,provider,provider_event_id,provider_payment_id,
   provider_subscription_id,billing_interval,period_start,period_end,period_start_source,period_end_source,
   provider_period_end_matches,derivation_version,derived_at)
  VALUES ('BP','T1','SUB','CHK','EVT','mercado_pago','evt-1','pay-1','sub-1','monthly',?,?,'provider_occurred_at',
          'academy_derived_from_checkout_interval',NULL,1,?)''',(now,period_end,now))

conn.execute('''UPDATE academy_subscriptions SET status='active',provider='mercado_pago',provider_subscription_id='sub-1',
  activation_reference='verified-provider-event:mercado_pago:evt-1',started_at=?,current_period_start=?,current_period_end=?,updated_at=?
  WHERE id='SUB' ''',(now,now,period_end,now))
conn.execute('''INSERT INTO academy_entitlements
  (id,tenant_id,user_id,source_type,source_id,plan_id,status,activation_evidence_type,activation_reference,starts_at,ends_at,created_at,updated_at)
  VALUES ('ENT','T1','U1','subscription','SUB','PLAN','active','verified_provider_event','verified-provider-event:mercado_pago:evt-1',?,?,?,?)''',
  (now,period_end,now,now))

assert conn.execute("SELECT current_period_start,current_period_end FROM academy_subscriptions WHERE id='SUB'").fetchone() == (now,period_end)
assert conn.execute("SELECT ends_at FROM academy_entitlements WHERE id='ENT'").fetchone() == (period_end,)
assert conn.execute("SELECT period_end_source FROM academy_subscription_billing_periods WHERE id='BP'").fetchone() == ('academy_derived_from_checkout_interval',)

# Billing period evidence is append-only.
try:
    conn.execute("UPDATE academy_subscription_billing_periods SET period_end='2027-03-01T18:00:00.000Z' WHERE id='BP'")
    raise AssertionError('derived billing evidence was mutable')
except sqlite3.IntegrityError:
    pass
try:
    conn.execute("DELETE FROM academy_subscription_billing_periods WHERE id='BP'")
    raise AssertionError('derived billing evidence was deletable')
except sqlite3.IntegrityError:
    pass

# Direct activation without derived period evidence is rejected.
conn.execute("INSERT INTO academy_subscriptions (id,tenant_id,user_id,plan_id,price_id,status,created_at,updated_at) VALUES ('SUB2','T1','U2','PLAN','PRICE','pending_payment',?,?)",(now,now))
try:
    conn.execute('''UPDATE academy_subscriptions SET status='active',provider='mercado_pago',provider_subscription_id='sub-2',
      activation_reference='forged',started_at=?,current_period_start=?,current_period_end=?,updated_at=? WHERE id='SUB2' ''',
      (now,now,period_end,now))
    raise AssertionError('paid subscription activated without derived billing period evidence')
except sqlite3.IntegrityError:
    pass

# Entitlement cannot diverge from the verified subscription period.
try:
    conn.execute('''UPDATE academy_entitlements SET ends_at='2027-03-01T18:00:00.000Z',updated_at=? WHERE id='ENT' ''',(now,))
    raise AssertionError('entitlement period diverged from subscription')
except sqlite3.IntegrityError:
    pass

conn.close()
print('Verified billing period integration fixture: PASS')
