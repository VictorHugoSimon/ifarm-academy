from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-15T18:00:00.000Z'
period_end = '2026-10-15T18:00:00.000Z'

conn.execute('''INSERT INTO academy_plans
  (id,tenant_id,slug,name,description,audience_type,commercial_mode,status,featured,created_by,created_at,updated_at)
  VALUES ('PLAN73','T1','pro-73','Pro 73','Plano','individual','priced','draft',0,'ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_plan_prices
  (id,tenant_id,plan_id,billing_interval,price_unit,version,amount_cents,currency,status,created_by,created_at,updated_at)
  VALUES ('PRICE73','T1','PLAN73','monthly','subscription',1,5990,'BRL','active','ADMIN',?,?)''',(now,now))
conn.execute("UPDATE academy_plans SET status='public',updated_at=? WHERE id='PLAN73'",(now,))
conn.execute("INSERT INTO academy_subscriptions (id,tenant_id,user_id,plan_id,price_id,status,created_at,updated_at) VALUES ('SUB73','T1','U73','PLAN73','PRICE73','pending_payment',?,?)",(now,now))
conn.execute('''INSERT INTO academy_checkout_sessions
  (id,tenant_id,user_id,plan_id,price_id,subscription_id,billing_interval,price_unit,price_version,amount_cents,currency,status,created_at,updated_at)
  VALUES ('CHK73','T1','U73','PLAN73','PRICE73','SUB73','monthly','subscription',1,5990,'BRL','pending',?,?)''',(now,now))
conn.execute("INSERT INTO academy_payment_state (checkout_session_id,tenant_id,status,amount_cents,currency,updated_at) VALUES ('CHK73','T1','pending',5990,'BRL',?)",(now,))

# Payment confirmation is valid with canonical payment/subscription identity even when provider did not expose a cycle end.
conn.execute('''INSERT INTO academy_payment_events
  (id,tenant_id,checkout_session_id,provider,provider_event_id,event_type,provider_payment_id,provider_subscription_id,
   amount_cents,currency,payload_hash,verified_at,received_at,processing_status)
  VALUES ('EVT73','T1','CHK73','mercado_pago','evt-73','confirmed','pay-73','sub-73',5990,'BRL',?,?,?,'received')''',('a'*64,now,now))
conn.execute("UPDATE academy_payment_state SET status='confirmed',provider='mercado_pago',provider_payment_id='pay-73',last_event_id='EVT73',confirmed_at=?,updated_at=? WHERE checkout_session_id='CHK73'",(now,now))
conn.execute("UPDATE academy_subscriptions SET status='active',provider='mercado_pago',provider_subscription_id='sub-73',activation_reference='verified-provider-event:mercado_pago:evt-73',started_at=?,current_period_start=NULL,current_period_end=NULL,updated_at=? WHERE id='SUB73'",(now,now))

assert conn.execute("SELECT status,current_period_start,current_period_end FROM academy_subscriptions WHERE id='SUB73'").fetchone() == ('active',None,None)

# Canonical resource explicitly lacked both period boundaries: record that absence, do not manufacture dates.
conn.execute('''INSERT INTO academy_subscription_billing_period_evidence
  (id,tenant_id,subscription_id,checkout_session_id,payment_event_id,provider,provider_resource_type,provider_resource_id,
   provider_subscription_id,evidence_status,period_start,period_end,observed_at,payload_hash,source,created_at)
  VALUES ('BE73A','T1','SUB73','CHK73','EVT73','mercado_pago','payment','pay-73','sub-73','unavailable',NULL,NULL,?,?,'canonical_provider_resource',?)''',(now,'b'*64,now))

assert conn.execute("SELECT evidence_status,period_start,period_end FROM academy_subscription_billing_period_evidence WHERE id='BE73A'").fetchone() == ('unavailable',None,None)

# Evidence is append-only.
try:
    conn.execute("UPDATE academy_subscription_billing_period_evidence SET period_end=? WHERE id='BE73A'",(period_end,))
    raise AssertionError('billing evidence was mutated')
except sqlite3.IntegrityError:
    pass

# Complete evidence is accepted only when both provider boundaries exist and range is valid.
conn.execute('''INSERT INTO academy_subscription_billing_period_evidence
  (id,tenant_id,subscription_id,checkout_session_id,payment_event_id,provider,provider_resource_type,provider_resource_id,
   provider_subscription_id,evidence_status,period_start,period_end,observed_at,payload_hash,source,created_at)
  VALUES ('BE73B','T1','SUB73','CHK73','EVT73','mercado_pago','authorized_payment','authpay-73','sub-73','complete',?,?,?,?,'canonical_provider_resource',?)''',(now,period_end,now,'c'*64,now))
assert conn.execute("SELECT evidence_status,period_start,period_end FROM academy_subscription_billing_period_evidence WHERE id='BE73B'").fetchone() == ('complete',now,period_end)

try:
    conn.execute('''INSERT INTO academy_subscription_billing_period_evidence
      (id,tenant_id,subscription_id,checkout_session_id,payment_event_id,provider,provider_resource_type,provider_resource_id,
       provider_subscription_id,evidence_status,period_start,period_end,observed_at,payload_hash,source,created_at)
      VALUES ('BAD73','T1','SUB73','CHK73','EVT73','mercado_pago','payment','bad-73','sub-73','complete',?,NULL,?,?,'canonical_provider_resource',?)''',(now,now,'d'*64,now))
    raise AssertionError('incomplete evidence was accepted as complete')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''INSERT INTO academy_subscription_billing_period_evidence
      (id,tenant_id,subscription_id,checkout_session_id,payment_event_id,provider,provider_resource_type,provider_resource_id,
       provider_subscription_id,evidence_status,period_start,period_end,observed_at,payload_hash,source,created_at)
      VALUES ('X73','T2','SUB73','CHK73','EVT73','mercado_pago','payment','x-73','sub-73','unavailable',NULL,NULL,?,?,'canonical_provider_resource',?)''',(now,'e'*64,now))
    raise AssertionError('cross-tenant billing evidence was accepted')
except sqlite3.IntegrityError:
    pass

# Static regression guard: the Mercado Pago webhook must never derive cycle boundaries from the local billing interval.
webhook = (ROOT / 'functions/api/payments/mercado-pago/webhook.ts').read_text(encoding='utf-8')
assert 'addBillingInterval' not in webhook
assert 'periodStart ?? canonical.occurredAt' not in webhook
assert 'periodEnd ??' not in webhook

conn.close()
print('Billing period evidence integration fixture: PASS')
