from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-07T19:00:00.000Z'

for tenant, course in [('T1','C1'),('T1','C2'),('T2','C3')]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?, 'published',0,0,1,'ADMIN','ADMIN',?,?)''',(course,tenant,f'Curso {course}','Descrição',now,now))

for tenant, course, slug in [('T1','C1','curso-1'),('T1','C2','curso-2'),('T2','C3','curso-3')]:
    conn.execute('''INSERT INTO academy_course_public_profiles
      (course_id,tenant_id,slug,visibility,access_model,currency,featured,updated_by,created_at,updated_at)
      VALUES (?,?,?,'public','free','BRL',0,'ADMIN',?,?)''',(course,tenant,slug,now,now))

conn.execute('''INSERT INTO academy_public_learning_paths
  (id,tenant_id,slug,title,description,visibility,featured,access_model,currency,created_by,created_at,updated_at)
  VALUES ('PATH1','T1','trilha-1','Trilha 1','Trilha pública','hidden',0,'free','BRL','ADMIN',?,?)''',(now,now))
conn.execute("INSERT INTO academy_public_learning_path_courses (id,tenant_id,path_id,course_id,position,created_at) VALUES ('PLC1','T1','PATH1','C1',0,?)",(now,))
conn.execute("UPDATE academy_public_learning_paths SET visibility='public',updated_at=? WHERE id='PATH1'",(now,))

# Paid plan cannot be published before an active price exists.
conn.execute('''INSERT INTO academy_plans
  (id,tenant_id,slug,name,description,audience_type,commercial_mode,status,featured,created_by,created_at,updated_at)
  VALUES ('PLAN1','T1','pro','Pro','Plano pago','individual','priced','draft',1,'ADMIN',?,?)''',(now,now))
conn.execute("INSERT INTO academy_plan_courses (id,tenant_id,plan_id,course_id,created_at) VALUES ('PC1','T1','PLAN1','C1',?)",(now,))
conn.execute("INSERT INTO academy_plan_courses (id,tenant_id,plan_id,course_id,created_at) VALUES ('PC2','T1','PLAN1','C2',?)",(now,))
conn.execute("INSERT INTO academy_plan_paths (id,tenant_id,plan_id,path_id,created_at) VALUES ('PP1','T1','PLAN1','PATH1',?)",(now,))
try:
    conn.execute("UPDATE academy_plans SET status='public',updated_at=? WHERE id='PLAN1'",(now,))
    raise AssertionError('priced plan without active price was published')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_plan_prices
  (id,tenant_id,plan_id,billing_interval,price_unit,version,amount_cents,currency,status,created_by,created_at,updated_at)
  VALUES ('PRICE1','T1','PLAN1','monthly','subscription',1,5990,'BRL','active','ADMIN',?,?)''',(now,now))
conn.execute("UPDATE academy_plans SET status='public',updated_at=? WHERE id='PLAN1'",(now,))

# Commercial snapshot is immutable once versioned.
try:
    conn.execute("UPDATE academy_plan_prices SET amount_cents=6990 WHERE id='PRICE1'")
    raise AssertionError('versioned price amount was mutated')
except sqlite3.IntegrityError:
    pass

# Only one active version per billing interval; retire before activating a new one.
try:
    conn.execute('''INSERT INTO academy_plan_prices
      (id,tenant_id,plan_id,billing_interval,price_unit,version,amount_cents,currency,status,created_by,created_at,updated_at)
      VALUES ('PRICE2','T1','PLAN1','monthly','subscription',2,6990,'BRL','active','ADMIN',?,?)''',(now,now))
    raise AssertionError('two active prices for the same interval were accepted')
except sqlite3.IntegrityError:
    pass
conn.execute("UPDATE academy_plan_prices SET status='retired',updated_at=? WHERE id='PRICE1'",(now,))
conn.execute('''INSERT INTO academy_plan_prices
  (id,tenant_id,plan_id,billing_interval,price_unit,version,amount_cents,currency,status,created_by,created_at,updated_at)
  VALUES ('PRICE2','T1','PLAN1','monthly','subscription',2,6990,'BRL','active','ADMIN',?,?)''',(now,now))

# A free plan can be published without a price and can reference ecosystem benefits without duplicating their catalog.
conn.execute('''INSERT INTO academy_plans
  (id,tenant_id,slug,name,description,audience_type,commercial_mode,status,featured,created_by,created_at,updated_at)
  VALUES ('FREE1','T1','free','Free','Plano gratuito','individual','free','draft',0,'ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_plan_external_benefits
  (id,tenant_id,plan_id,source_system,external_ref,label,description,created_at)
  VALUES ('BEN1','T1','FREE1','ifarm_store','SKU-123','Kit de sensores','Referência comercial, sem replicar catálogo',?)''',(now,))
conn.execute("UPDATE academy_plans SET status='public',updated_at=? WHERE id='FREE1'",(now,))
try:
    conn.execute('''INSERT INTO academy_plan_prices
      (id,tenant_id,plan_id,billing_interval,price_unit,version,amount_cents,currency,status,created_by,created_at,updated_at)
      VALUES ('FREEPRICE','T1','FREE1','monthly','subscription',1,100,'BRL','draft','ADMIN',?,?)''',(now,now))
    raise AssertionError('free plan accepted a price row')
except sqlite3.IntegrityError:
    pass

# Cross-tenant entitlement is blocked.
try:
    conn.execute("INSERT INTO academy_plan_courses (id,tenant_id,plan_id,course_id,created_at) VALUES ('X','T1','FREE1','C3',?)",(now,))
    raise AssertionError('cross-tenant course entered plan')
except sqlite3.IntegrityError:
    pass

# Public plan cannot receive a hidden/non-public course after publication.
conn.execute("UPDATE academy_course_public_profiles SET visibility='hidden' WHERE course_id='C2'")
try:
    conn.execute("INSERT INTO academy_plan_courses (id,tenant_id,plan_id,course_id,created_at) VALUES ('HIDDEN','T1','FREE1','C2',?)",(now,))
    raise AssertionError('hidden course entered public plan')
except sqlite3.IntegrityError:
    pass
conn.execute("UPDATE academy_course_public_profiles SET visibility='public' WHERE course_id='C2'")

# Paid subscription activation requires a real provider confirmation; pending payment does not.
conn.execute('''INSERT INTO academy_subscriptions
  (id,tenant_id,user_id,plan_id,price_id,status,created_at,updated_at)
  VALUES ('SUBP','T1','U1','PLAN1','PRICE2','pending_payment',?,?)''',(now,now))
try:
    conn.execute('''INSERT INTO academy_subscriptions
      (id,tenant_id,user_id,plan_id,price_id,status,activation_reference,started_at,current_period_end,created_at,updated_at)
      VALUES ('SUBBAD','T1','U2','PLAN1','PRICE2','active','manual',?, '2026-10-07T19:00:00.000Z',?,?)''',(now,now,now))
    raise AssertionError('paid subscription activated without provider')
except sqlite3.IntegrityError:
    pass
conn.execute('''INSERT INTO academy_subscriptions
  (id,tenant_id,user_id,plan_id,price_id,status,provider,provider_subscription_id,activation_reference,started_at,current_period_start,current_period_end,created_at,updated_at)
  VALUES ('SUBOK','T1','U2','PLAN1','PRICE2','active','mercado_pago','MP-1','webhook:evt-1',?,?, '2026-10-07T19:00:00.000Z',?,?)''',(now,now,now,now))

# Free/contractual activation still requires an explicit activation reference, but not a fake gateway.
try:
    conn.execute('''INSERT INTO academy_subscriptions
      (id,tenant_id,user_id,plan_id,status,started_at,created_at,updated_at)
      VALUES ('FREEBAD','T1','U3','FREE1','active',?,?,?)''',(now,now,now))
    raise AssertionError('free subscription activated without explicit reference')
except sqlite3.IntegrityError:
    pass
conn.execute('''INSERT INTO academy_subscriptions
  (id,tenant_id,user_id,plan_id,status,activation_reference,started_at,created_at,updated_at)
  VALUES ('FREEOK','T1','U3','FREE1','active','admin-contract:approved',?,?,?)''',(now,now,now))

# White-label selected catalog filters the public plan course projection.
conn.execute('''INSERT INTO academy_white_label_settings
  (tenant_id,brand_name,academy_name,primary_color,secondary_color,accent_color,catalog_mode,status,updated_by,created_at,updated_at)
  VALUES ('T1','Marca X','Marca X Academy','#123456','#234567','#345678','selected_courses','active','ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_white_label_catalog_courses
  (tenant_id,course_id,visible,featured,updated_by,updated_at)
  VALUES ('T1','C1',1,1,'ADMIN',?)''',(now,))
visible = conn.execute('''SELECT pc.course_id
  FROM academy_plan_courses pc
  JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id AND c.status='published'
  JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id AND cp.visibility='public'
  LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=pc.tenant_id AND ws.status='active'
  LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=pc.tenant_id AND wc.course_id=pc.course_id AND wc.visible=1
  WHERE pc.tenant_id='T1' AND pc.plan_id='PLAN1'
    AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
  ORDER BY pc.course_id''').fetchall()
assert visible == [('C1',)]

# Public benefits never need to expose the external reference itself.
benefit_public = conn.execute("SELECT source_system,label,description FROM academy_plan_external_benefits WHERE id='BEN1'").fetchone()
assert benefit_public == ('ifarm_store','Kit de sensores','Referência comercial, sem replicar catálogo')

conn.close()
print('Plans and subscriptions integration fixture: PASS')
