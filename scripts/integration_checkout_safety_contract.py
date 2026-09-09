from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-09T18:00:00.000Z'
future = '2099-09-10T18:00:00.000Z'
future_end = '2099-09-10T22:00:00.000Z'

for tenant, course, price in [('T1','C1',10000),('T2','C2',12000)]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,'Descrição','published',0,0,1,'ADMIN','ADMIN',?,?)''',(course,tenant,f'Curso {course}',now,now))
    conn.execute('''INSERT INTO academy_course_public_profiles
      (course_id,tenant_id,slug,visibility,access_model,list_price_cents,currency,featured,updated_by,created_at,updated_at)
      VALUES (?,?,?,'public','paid',?,'BRL',0,'ADMIN',?,?)''',(course,tenant,f'curso-{course.lower()}',price,now,now))

conn.execute('''INSERT INTO academy_plans
  (id,tenant_id,slug,name,description,audience_type,commercial_mode,status,featured,created_by,created_at,updated_at)
  VALUES ('PLAN1','T1','pro','Plano Pro','Plano pago','individual','priced','draft',0,'ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_plan_prices
  (id,tenant_id,plan_id,billing_interval,price_unit,version,amount_cents,currency,status,created_by,created_at,updated_at)
  VALUES ('PRICE1','T1','PLAN1','monthly','subscription',1,5990,'BRL','active','ADMIN',?,?)''',(now,now))
conn.execute("UPDATE academy_plans SET status='public',updated_at=? WHERE id='PLAN1'",(now,))

conn.execute('''INSERT INTO academy_events
  (id,tenant_id,title,description,event_type,modality,status,access_model,price_cents,currency,starts_at,ends_at,timezone,created_by,created_at,updated_at)
  VALUES ('E1','T1','Dia de Campo','Evento pago','field_day','in_person','published','paid',5000,'BRL',?,?,'America/Sao_Paulo','ADMIN',?,?)''',(future,future_end,now,now))

# One immutable cart snapshot composed only from authoritative published prices.
conn.execute('''INSERT INTO academy_orders
  (id,tenant_id,user_id,idempotency_key,status,total_amount_cents,currency,item_count,created_at,updated_at)
  VALUES ('O1','T1','U1','checkout:test-001','building',20990,'BRL',3,?,?)''',(now,now))
conn.execute('''INSERT INTO academy_order_items
  (id,tenant_id,order_id,product_type,product_id,price_ref,description_snapshot,quantity,unit_amount_cents,total_amount_cents,currency,created_at)
  VALUES ('OI1','T1','O1','course','C1',NULL,'Curso C1',1,10000,10000,'BRL',?)''',(now,))
conn.execute('''INSERT INTO academy_order_items
  (id,tenant_id,order_id,product_type,product_id,price_ref,description_snapshot,quantity,unit_amount_cents,total_amount_cents,currency,created_at)
  VALUES ('OI2','T1','O1','plan','PLAN1','PRICE1','Plano Pro',1,5990,5990,'BRL',?)''',(now,))
conn.execute('''INSERT INTO academy_order_items
  (id,tenant_id,order_id,product_type,product_id,price_ref,description_snapshot,quantity,unit_amount_cents,total_amount_cents,currency,created_at)
  VALUES ('OI3','T1','O1','event','E1',NULL,'Dia de Campo',1,5000,5000,'BRL',?)''',(now,))
conn.execute("UPDATE academy_orders SET status='awaiting_payment',updated_at=? WHERE id='O1'",(now,))

# Payment cannot be confirmed without a verified approved provider record.
try:
    conn.execute("UPDATE academy_orders SET status='payment_confirmed',confirmed_at=?,updated_at=? WHERE id='O1'",(now,now))
    raise AssertionError('order confirmed without verified payment')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_order_payments
  (id,tenant_id,order_id,provider,status,verification_status,amount_cents,currency,observed_at,created_at,updated_at)
  VALUES ('PAY1','T1','O1','mercado_pago','approved','unverified',20990,'BRL',?,?,?)''',(now,now,now))
try:
    conn.execute("UPDATE academy_orders SET status='payment_confirmed',confirmed_at=?,updated_at=? WHERE id='O1'",(now,now))
    raise AssertionError('unverified approved payment confirmed order')
except sqlite3.IntegrityError:
    pass

# A future trusted adapter can verify an exact provider observation; only then can the order close.
conn.execute('''UPDATE academy_order_payments
  SET provider_payment_id='MP-123',verification_status='verified',verified_at=?,verification_reference='webhook:evt-1',updated_at=?
  WHERE id='PAY1' ''',(now,now))
conn.execute("UPDATE academy_orders SET status='payment_confirmed',confirmed_at=?,updated_at=? WHERE id='O1'",(now,now))
assert conn.execute("SELECT status FROM academy_orders WHERE id='O1'").fetchone() == ('payment_confirmed',)

# A verified payment with a mismatched amount is rejected by the database.
conn.execute('''INSERT INTO academy_orders
  (id,tenant_id,user_id,idempotency_key,status,total_amount_cents,currency,item_count,created_at,updated_at)
  VALUES ('O2','T1','U2','checkout:test-002','building',10000,'BRL',1,?,?)''',(now,now))
conn.execute('''INSERT INTO academy_order_items
  (id,tenant_id,order_id,product_type,product_id,price_ref,description_snapshot,quantity,unit_amount_cents,total_amount_cents,currency,created_at)
  VALUES ('OI4','T1','O2','course','C1',NULL,'Curso C1',1,10000,10000,'BRL',?)''',(now,))
conn.execute("UPDATE academy_orders SET status='awaiting_payment',updated_at=? WHERE id='O2'",(now,))
try:
    conn.execute('''INSERT INTO academy_order_payments
      (id,tenant_id,order_id,provider,provider_payment_id,status,verification_status,amount_cents,currency,observed_at,verified_at,verification_reference,created_at,updated_at)
      VALUES ('PAYBAD','T1','O2','mercado_pago','MP-BAD','approved','verified',9999,'BRL',?,?, 'webhook:bad',?,?)''',(now,now,now,now))
    raise AssertionError('mismatched verified payment was accepted')
except sqlite3.IntegrityError:
    pass

# Browser/admin cannot tamper with snapshots, cross tenant products or quantities.
try:
    conn.execute("UPDATE academy_order_items SET unit_amount_cents=1,total_amount_cents=1 WHERE id='OI4'")
    raise AssertionError('order item snapshot was mutated')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''INSERT INTO academy_order_items
      (id,tenant_id,order_id,product_type,product_id,description_snapshot,quantity,unit_amount_cents,total_amount_cents,currency,created_at)
      VALUES ('BADPRICE','T1','O2','course','C1','Curso',1,1,1,'BRL',?)''',(now,))
    raise AssertionError('client-controlled course price was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_orders
  (id,tenant_id,user_id,idempotency_key,status,total_amount_cents,currency,item_count,created_at,updated_at)
  VALUES ('O3','T1','U3','checkout:test-003','building',12000,'BRL',1,?,?)''',(now,now))
try:
    conn.execute('''INSERT INTO academy_order_items
      (id,tenant_id,order_id,product_type,product_id,description_snapshot,quantity,unit_amount_cents,total_amount_cents,currency,created_at)
      VALUES ('CROSS','T1','O3','course','C2','Cross',1,12000,12000,'BRL',?)''',(now,))
    raise AssertionError('cross-tenant product entered order')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_orders
  (id,tenant_id,user_id,idempotency_key,status,total_amount_cents,currency,item_count,created_at,updated_at)
  VALUES ('O4','T1','U4','checkout:test-004','building',20000,'BRL',1,?,?)''',(now,now))
try:
    conn.execute('''INSERT INTO academy_order_items
      (id,tenant_id,order_id,product_type,product_id,description_snapshot,quantity,unit_amount_cents,total_amount_cents,currency,created_at)
      VALUES ('QTYBAD','T1','O4','course','C1','Curso',2,10000,20000,'BRL',?)''',(now,))
    raise AssertionError('course quantity >1 was accepted')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''INSERT INTO academy_order_items
      (id,tenant_id,order_id,product_type,product_id,price_ref,description_snapshot,quantity,unit_amount_cents,total_amount_cents,currency,created_at)
      VALUES ('PLANQTYBAD','T1','O4','plan','PLAN1','PRICE1','Plano',2,5990,11980,'BRL',?)''',(now,))
    raise AssertionError('subscription plan quantity >1 was accepted')
except sqlite3.IntegrityError:
    pass

# Idempotency key is scoped to tenant + user.
try:
    conn.execute('''INSERT INTO academy_orders
      (id,tenant_id,user_id,idempotency_key,status,total_amount_cents,currency,item_count,created_at,updated_at)
      VALUES ('ODUP','T1','U1','checkout:test-001','building',10000,'BRL',1,?,?)''',(now,now))
    raise AssertionError('duplicate idempotency key was accepted')
except sqlite3.IntegrityError:
    pass

# Confirming payment does not create entitlements by itself in v0.62.
assert conn.execute("SELECT COUNT(*) FROM academy_enrollments WHERE tenant_id='T1' AND student_id='U1'").fetchone()[0] == 0
assert conn.execute("SELECT COUNT(*) FROM academy_subscriptions WHERE tenant_id='T1' AND user_id='U1'").fetchone()[0] == 0
assert conn.execute("SELECT COUNT(*) FROM academy_event_registrations WHERE tenant_id='T1' AND user_id='U1'").fetchone()[0] == 0

conn.close()
print('Checkout safety integration fixture: PASS')
