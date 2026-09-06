from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-06T22:00:00.000Z'

for tenant, course, status in [
    ('T1','C1','published'),('T1','C2','published'),('T1','C-DRAFT','draft'),('T2','C3','published')
]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?,?,0,0,1,'ADMIN','ADMIN',?,?)''',
      (course,tenant,f'Curso {course}','Descrição',status,now,now))

conn.execute('''INSERT INTO academy_course_public_profiles
  (course_id,tenant_id,slug,category,short_description,visibility,access_model,list_price_cents,currency,featured,updated_by,created_at,updated_at)
  VALUES ('C1','T1','agricultura-digital','Agricultura Digital','Curso público','public','free',NULL,'BRL',1,'ADMIN',?,?)''', (now,now))
conn.execute('''INSERT INTO academy_course_public_profiles
  (course_id,tenant_id,slug,category,short_description,visibility,access_model,list_price_cents,currency,featured,updated_by,created_at,updated_at)
  VALUES ('C2','T1','iot-rural','Tecnologia','Curso pago','public','paid',19990,'BRL',0,'ADMIN',?,?)''', (now,now))

# Same slug may exist in another tenant because host resolves tenant first.
conn.execute('''INSERT INTO academy_course_public_profiles
  (course_id,tenant_id,slug,visibility,access_model,currency,featured,updated_by,created_at,updated_at)
  VALUES ('C3','T2','agricultura-digital','public','free','BRL',0,'ADMIN2',?,?)''', (now,now))

# Duplicate slug in the same tenant is rejected.
try:
    conn.execute('''UPDATE academy_course_public_profiles SET slug='agricultura-digital' WHERE course_id='C2' ''')
    raise AssertionError('duplicate public slug in same tenant was accepted')
except sqlite3.IntegrityError:
    pass

# Cross-tenant course/profile identity is rejected.
try:
    conn.execute('''INSERT INTO academy_course_public_profiles
      (course_id,tenant_id,slug,visibility,access_model,currency,featured,updated_by,created_at,updated_at)
      VALUES ('C3','T1','cross-tenant','public','free','BRL',0,'ADMIN',?,?)''', (now,now))
    raise AssertionError('cross-tenant public profile was accepted')
except sqlite3.IntegrityError:
    pass

# Draft courses cannot be made public.
try:
    conn.execute('''INSERT INTO academy_course_public_profiles
      (course_id,tenant_id,slug,visibility,access_model,currency,featured,updated_by,created_at,updated_at)
      VALUES ('C-DRAFT','T1','draft-course','public','free','BRL',0,'ADMIN',?,?)''', (now,now))
    raise AssertionError('draft course was exposed publicly')
except sqlite3.IntegrityError:
    pass

# Paid courses require a positive price.
try:
    conn.execute('''UPDATE academy_course_public_profiles SET list_price_cents=NULL WHERE course_id='C2' ''')
    raise AssertionError('paid public course without price was accepted')
except sqlite3.IntegrityError:
    pass

# Non-paid courses cannot accidentally carry a commercial price.
try:
    conn.execute("UPDATE academy_course_public_profiles SET list_price_cents=1000 WHERE course_id='C1'")
    raise AssertionError('free course with positive price was accepted')
except sqlite3.IntegrityError:
    pass

# White-label selected catalog limits the public surface.
conn.execute('''INSERT INTO academy_white_label_settings
  (tenant_id,brand_name,academy_name,primary_color,secondary_color,accent_color,catalog_mode,status,updated_by,created_at,updated_at)
  VALUES ('T1','Marca X','Marca X Academy','#123456','#234567','#345678','selected_courses','active','ADMIN',?,?)''', (now,now))
conn.execute('''INSERT INTO academy_white_label_catalog_courses
  (tenant_id,course_id,visible,featured,updated_by,updated_at)
  VALUES ('T1','C1',1,1,'ADMIN',?)''', (now,))

visible = conn.execute('''
  SELECT p.course_id
  FROM academy_course_public_profiles p
  JOIN academy_courses c ON c.id=p.course_id AND c.tenant_id=p.tenant_id AND c.status='published'
  LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
  LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
  WHERE p.tenant_id='T1' AND p.visibility='public'
    AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
  ORDER BY p.course_id
''').fetchall()
assert visible == [('C1',)]

# Only verified domains may represent a public white-label host.
conn.execute('''INSERT INTO academy_white_label_domains
  (id,tenant_id,hostname,status,is_primary,requested_by,requested_at,verification_reference,verified_by,verified_at,updated_at)
  VALUES ('D1','T1','academy.partner.example','verified',1,'ADMIN',?,'DNS reviewed','IFARM-ADMIN',?,?)''', (now,now,now))
resolved = conn.execute("SELECT tenant_id FROM academy_white_label_domains WHERE hostname='academy.partner.example' AND status='verified'").fetchone()
assert resolved == ('T1',)

conn.close()
print('Public portal integration fixture: PASS')
