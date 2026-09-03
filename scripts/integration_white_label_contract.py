from pathlib import Path
import json
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-03T12:00:00.000Z'

for tenant, course in [('T1','C1'),('T1','C2'),('T2','C3')]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?, 'published',0,0,1,'ADMIN','ADMIN',?,?)''',
      (course,tenant,f'Curso {course}','',now,now))

conn.execute('''INSERT INTO academy_white_label_settings
  (tenant_id,brand_name,academy_name,primary_color,secondary_color,accent_color,logo_ref,certificate_heading,catalog_mode,status,updated_by,created_at,updated_at)
  VALUES ('T1','Cooperativa X','Cooperativa X Academy','#123456','#234567','#345678',NULL,'Certificado Cooperativa X','selected_courses','active','ADMIN',?,?)''', (now,now))

# Primary domains cannot be pending.
try:
    conn.execute('''INSERT INTO academy_white_label_domains
      (id,tenant_id,hostname,status,is_primary,requested_by,requested_at,updated_at)
      VALUES ('D-BAD','T1','bad.example.com','pending',1,'ADMIN',?,?)''', (now,now))
    raise AssertionError('pending primary domain was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_white_label_domains
  (id,tenant_id,hostname,status,is_primary,requested_by,requested_at,updated_at)
  VALUES ('D1','T1','academy.example.com','pending',0,'ADMIN',?,?)''', (now,now))

# Verification requires human evidence/reference.
try:
    conn.execute("UPDATE academy_white_label_domains SET status='verified' WHERE id='D1'")
    raise AssertionError('domain verified without evidence')
except sqlite3.IntegrityError:
    pass

conn.execute("""UPDATE academy_white_label_domains
  SET status='verified',is_primary=1,verification_reference='DNS reviewed by iFarm admin',verified_by='IFARM-ADMIN',verified_at=?,updated_at=?
  WHERE id='D1'""", (now,now))

# Hostname is globally unique, preventing ambiguous host routing between tenants.
try:
    conn.execute('''INSERT INTO academy_white_label_domains
      (id,tenant_id,hostname,status,is_primary,requested_by,requested_at,updated_at)
      VALUES ('D2','T2','academy.example.com','pending',0,'ADMIN2',?,?)''', (now,now))
    raise AssertionError('duplicate white-label hostname was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_white_label_catalog_courses
  (tenant_id,course_id,visible,featured,updated_by,updated_at)
  VALUES ('T1','C1',1,1,'ADMIN',?)''', (now,))

# Catalog scope cannot include a course from another tenant.
try:
    conn.execute('''INSERT INTO academy_white_label_catalog_courses
      (tenant_id,course_id,visible,featured,updated_by,updated_at)
      VALUES ('T1','C3',1,0,'ADMIN',?)''', (now,))
    raise AssertionError('cross-tenant white-label catalog course was accepted')
except sqlite3.IntegrityError:
    pass

# Create a completed learning cycle so certificate integrity triggers are respected.
conn.execute('''INSERT INTO academy_enrollments
  (id,tenant_id,course_id,student_id,student_name_snapshot,source,status,enrolled_at,completed_at,updated_at,active_cycle_id)
  VALUES ('E1','T1','C1','S1','Aluno Teste','academy','completed',?,?,?,NULL)''', (now,now,now))
conn.execute('''INSERT INTO academy_learning_cycles
  (id,tenant_id,enrollment_id,student_id,course_id,cycle_number,status,source,started_at,completed_at,created_at,updated_at)
  VALUES ('LC1','T1','E1','S1','C1',1,'completed','academy',?,?,?,?,?)''', (now,now,now,now))
conn.execute("UPDATE academy_enrollments SET active_cycle_id='LC1' WHERE id='E1'")

snapshot = json.dumps({
    'version': 1,
    'brandName': 'Cooperativa X',
    'academyName': 'Cooperativa X Academy',
    'primaryColor': '#123456',
    'secondaryColor': '#234567',
    'accentColor': '#345678',
    'whiteLabelConfigured': True,
})
conn.execute('''INSERT INTO academy_certificates
  (id,cycle_id,public_code,student_id,student_name,course_id,course_title,issued_at,status,tenant_id,certificate_type,metadata_version,brand_snapshot_json)
  VALUES ('CERT1','LC1','IFA-TEST-WL','S1','Aluno Teste','C1','Curso C1',?,'valid','T1','free_course',3,?)''', (now,snapshot))

# Future brand changes must not mutate the historical certificate snapshot.
conn.execute("UPDATE academy_white_label_settings SET brand_name='Nova Marca',academy_name='Nova Academy',updated_at=? WHERE tenant_id='T1'", (now,))
stored = json.loads(conn.execute("SELECT brand_snapshot_json FROM academy_certificates WHERE id='CERT1'").fetchone()[0])
assert stored['brandName'] == 'Cooperativa X'
assert stored['academyName'] == 'Cooperativa X Academy'

primary = conn.execute("SELECT hostname FROM academy_white_label_domains WHERE tenant_id='T1' AND status='verified' AND is_primary=1").fetchone()[0]
assert primary == 'academy.example.com'
selected = conn.execute("SELECT course_id,featured FROM academy_white_label_catalog_courses WHERE tenant_id='T1'").fetchall()
assert selected == [('C1',1)]

columns = {row[1] for row in conn.execute('PRAGMA table_info(academy_certificates)').fetchall()}
assert 'brand_snapshot_json' in columns
conn.close()
print('White label integration fixture: PASS')
