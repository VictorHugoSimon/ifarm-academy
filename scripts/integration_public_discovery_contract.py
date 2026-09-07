from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-07T18:00:00.000Z'

for tenant, course in [('T1','C1'),('T1','C2'),('T2','C3')]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?, 'published',0,0,1,'ADMIN','ADMIN',?,?)''',
      (course,tenant,f'Curso {course}','Descrição',now,now))
    conn.execute('''INSERT INTO academy_course_public_profiles
      (course_id,tenant_id,slug,visibility,access_model,currency,featured,updated_by,created_at,updated_at)
      VALUES (?,?,?,'public','free','BRL',0,'ADMIN',?,?)''',
      (course,tenant,f'curso-{course.lower()}',now,now))

conn.execute('''INSERT INTO academy_instructors
  (id,tenant_id,user_id,display_name_snapshot,bio,status,created_by,created_at,updated_at)
  VALUES ('I1','T1','U1','Ana Técnica','Bio privada','active','ADMIN',?,?)''', (now,now))
conn.execute('''INSERT INTO academy_instructor_qualifications
  (id,tenant_id,instructor_id,qualification_type,title,council_name,registration_number,verification_status,evidence_ref,declared_by,created_at,updated_at)
  VALUES ('Q1','T1','I1','council_registration','Registro profissional','CONSELHO','SECRET-123','verified','private/evidence.pdf','ADMIN',?,?)''', (now,now))
conn.execute('''INSERT INTO academy_instructor_public_profiles
  (instructor_id,tenant_id,slug,visibility,headline,short_bio,public_specialties_json,credential_summary,featured,created_by,created_at,updated_at)
  VALUES ('I1','T1','ana-tecnica','public','Especialista em campo','Resumo público','["IoT Rural"]','Formação técnica verificada pela operação',1,'ADMIN',?,?)''', (now,now))

# Public projection never stores private evidence/registration fields.
profile_columns = {row[1] for row in conn.execute('PRAGMA table_info(academy_instructor_public_profiles)').fetchall()}
assert 'registration_number' not in profile_columns
assert 'evidence_ref' not in profile_columns

# Cross-tenant instructor/profile mismatch is rejected.
try:
    conn.execute('''INSERT INTO academy_instructor_public_profiles
      (instructor_id,tenant_id,slug,visibility,public_specialties_json,featured,created_by,created_at,updated_at)
      VALUES ('I1','T2','cross-tenant','hidden','[]',0,'ADMIN2',?,?)''', (now,now))
    raise AssertionError('cross-tenant public instructor profile was accepted')
except sqlite3.IntegrityError:
    pass

# Inactive instructor cannot be published.
conn.execute('''INSERT INTO academy_instructors
  (id,tenant_id,user_id,display_name_snapshot,bio,status,created_by,created_at,updated_at)
  VALUES ('I2','T1','U2','Instrutor Inativo','','inactive','ADMIN',?,?)''', (now,now))
try:
    conn.execute('''INSERT INTO academy_instructor_public_profiles
      (instructor_id,tenant_id,slug,visibility,public_specialties_json,featured,created_by,created_at,updated_at)
      VALUES ('I2','T1','instrutor-inativo','public','[]',0,'ADMIN',?,?)''', (now,now))
    raise AssertionError('inactive instructor was exposed publicly')
except sqlite3.IntegrityError:
    pass

# Create hidden path, attach valid courses, then publish.
conn.execute('''INSERT INTO academy_public_learning_paths
  (id,tenant_id,slug,title,description,visibility,featured,access_model,currency,created_by,created_at,updated_at)
  VALUES ('P1','T1','trilha-digital','Trilha Digital','Descrição','hidden',1,'free','BRL','ADMIN',?,?)''', (now,now))
for position, course in enumerate(['C1','C2']):
    conn.execute('''INSERT INTO academy_public_learning_path_courses
      (id,tenant_id,path_id,course_id,position,created_at) VALUES (?,?,?,?,?,?)''',
      (f'PC{position+1}','T1','P1',course,position,now))
conn.execute("UPDATE academy_public_learning_paths SET visibility='public' WHERE id='P1'")

# Cross-tenant course cannot be inserted in T1 path.
try:
    conn.execute('''INSERT INTO academy_public_learning_path_courses
      (id,tenant_id,path_id,course_id,position,created_at) VALUES ('PCX','T1','P1','C3',3,?)''', (now,))
    raise AssertionError('cross-tenant path course was accepted')
except sqlite3.IntegrityError:
    pass

# Empty path cannot become public.
conn.execute('''INSERT INTO academy_public_learning_paths
  (id,tenant_id,slug,title,description,visibility,featured,access_model,currency,created_by,created_at,updated_at)
  VALUES ('P2','T1','vazia','Vazia','','hidden',0,'free','BRL','ADMIN',?,?)''', (now,now))
try:
    conn.execute("UPDATE academy_public_learning_paths SET visibility='public' WHERE id='P2'")
    raise AssertionError('empty path was published')
except sqlite3.IntegrityError:
    pass

# White Label selected catalog hides C2 from path/instructor public projection.
conn.execute('''INSERT INTO academy_white_label_settings
  (tenant_id,brand_name,academy_name,primary_color,secondary_color,accent_color,catalog_mode,status,updated_by,created_at,updated_at)
  VALUES ('T1','Marca','Academy','#123456','#234567','#345678','selected_courses','active','ADMIN',?,?)''', (now,now))
conn.execute('''INSERT INTO academy_white_label_catalog_courses
  (tenant_id,course_id,visible,featured,updated_by,updated_at)
  VALUES ('T1','C1',1,1,'ADMIN',?)''', (now,))
visible_path_courses = conn.execute('''
  SELECT pc.course_id FROM academy_public_learning_path_courses pc
  JOIN academy_courses c ON c.id=pc.course_id AND c.tenant_id=pc.tenant_id AND c.status='published'
  JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
  LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
  LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
  WHERE pc.tenant_id='T1' AND pc.path_id='P1'
    AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
  ORDER BY pc.position
''').fetchall()
assert visible_path_courses == [('C1',)]

conn.execute('''INSERT INTO academy_course_instructor_roles
  (id,tenant_id,course_id,instructor_id,role,suitability_confirmed,status,assigned_by,created_at,updated_at)
  VALUES ('R1','T1','C1','I1','instructor',0,'active','ADMIN',?,?)''', (now,now))
conn.execute('''INSERT INTO academy_course_instructor_roles
  (id,tenant_id,course_id,instructor_id,role,suitability_confirmed,status,assigned_by,created_at,updated_at)
  VALUES ('R2','T1','C2','I1','instructor',0,'active','ADMIN',?,?)''', (now,now))
visible_instructor_courses = conn.execute('''
  SELECT r.course_id FROM academy_course_instructor_roles r
  JOIN academy_courses c ON c.id=r.course_id AND c.tenant_id=r.tenant_id AND c.status='published'
  JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
  LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
  LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
  WHERE r.tenant_id='T1' AND r.instructor_id='I1' AND r.status='active'
    AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
  ORDER BY r.course_id
''').fetchall()
assert visible_instructor_courses == [('C1',)]

conn.close()
print('Public discovery integration fixture: PASS')
