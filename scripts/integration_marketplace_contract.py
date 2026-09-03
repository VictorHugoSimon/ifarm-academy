from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-03T12:00:00.000Z'

for tenant, course, instructor, user in [
    ('T1','C1','I1','U1'),
    ('T2','C2','I2','U2'),
]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?, 'published',0,0,1,?,?,?,?)''',
      (course, tenant, f'Curso {course}', '', user, user, now, now))
    conn.execute('''INSERT INTO academy_instructors
      (id,tenant_id,user_id,display_name_snapshot,bio,status,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,'active',?,?,?)''',
      (instructor, tenant, user, f'Instrutor {instructor}', '', user, now, now))
    conn.execute('''INSERT INTO academy_course_instructor_roles
      (id,tenant_id,course_id,instructor_id,role,qualification_id,suitability_confirmed,status,assigned_by,created_at,updated_at)
      VALUES (?,?,?,?, 'author',NULL,0,'active',?,?,?)''',
      (f'R-{tenant}', tenant, course, instructor, user, now, now))

conn.execute('''INSERT INTO academy_marketplace_submissions
  (id,tenant_id,course_id,submitter_instructor_id,status,submitted_at,created_at,updated_at)
  VALUES ('S1','T1','C1','I1','approved',?,?,?)''', (now,now,now))

# Cross-tenant course must be rejected.
try:
    conn.execute('''INSERT INTO academy_marketplace_submissions
      (id,tenant_id,course_id,submitter_instructor_id,status,submitted_at,created_at,updated_at)
      VALUES ('BAD1','T1','C2','I1','submitted',?,?,?)''', (now,now,now))
    raise AssertionError('cross-tenant marketplace submission was accepted')
except sqlite3.IntegrityError:
    pass

# Instructor without an active author/instructor role must be rejected.
conn.execute('''INSERT INTO academy_instructors
  (id,tenant_id,user_id,display_name_snapshot,bio,status,created_by,created_at,updated_at)
  VALUES ('I3','T1','U3','Instrutor sem papel','','active','U3',?,?)''', (now,now))
try:
    conn.execute('''INSERT INTO academy_marketplace_submissions
      (id,tenant_id,course_id,submitter_instructor_id,status,submitted_at,created_at,updated_at)
      VALUES ('BAD2','T1','C1','I3','submitted',?,?,?)''', (now,now,now))
    raise AssertionError('submission without course role was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_marketplace_commission_rules
  (id,tenant_id,submission_id,version,status,calculation_mode,
   ifarm_share_value,instructor_share_value,partner_share_value,currency,
   gateway_fee_responsibility,valid_from,valid_until,rationale,confirmed_by,confirmed_at,created_at)
  VALUES ('CR1','T1','S1',1,'active','percentage',2000,7500,500,'BRL','shared',?,NULL,'Regra aprovada','ADMIN',?,?)''',
  (now,now,now))

# Percent shares must total exactly 10000 basis points.
try:
    conn.execute("UPDATE academy_marketplace_commission_rules SET ifarm_share_value=1000 WHERE id='CR1'")
    raise AssertionError('invalid percentage allocation was accepted')
except sqlite3.IntegrityError:
    pass

# Only one active rule can exist for a submission.
try:
    conn.execute('''INSERT INTO academy_marketplace_commission_rules
      (id,tenant_id,submission_id,version,status,calculation_mode,
       ifarm_share_value,instructor_share_value,partner_share_value,currency,
       gateway_fee_responsibility,valid_from,valid_until,rationale,confirmed_by,confirmed_at,created_at)
      VALUES ('CR2','T1','S1',2,'active','percentage',2000,8000,0,'BRL','ifarm',?,NULL,'Segunda ativa','ADMIN',?,?)''',
      (now,now,now))
    raise AssertionError('multiple active commission rules were accepted')
except sqlite3.IntegrityError:
    pass

# Commission rule cannot point to a submission from another tenant.
try:
    conn.execute('''INSERT INTO academy_marketplace_commission_rules
      (id,tenant_id,submission_id,version,status,calculation_mode,
       ifarm_share_value,instructor_share_value,partner_share_value,currency,
       gateway_fee_responsibility,valid_from,valid_until,rationale,confirmed_by,confirmed_at,created_at)
      VALUES ('BAD3','T2','S1',1,'retired','percentage',2000,8000,0,'BRL','ifarm',?,NULL,'Cross tenant','ADMIN',?,?)''',
      (now,now,now))
    raise AssertionError('cross-tenant commission rule was accepted')
except sqlite3.IntegrityError:
    pass

row = conn.execute("SELECT calculation_mode,ifarm_share_value,instructor_share_value,partner_share_value FROM academy_marketplace_commission_rules WHERE id='CR1'").fetchone()
assert row == ('percentage', 2000, 7500, 500)
conn.close()
print('Marketplace integration fixture: PASS')
