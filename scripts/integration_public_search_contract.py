from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.row_factory = sqlite3.Row
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-10T12:00:00.000Z'
future_start = '2099-10-10T12:00:00.000Z'
future_end = '2099-10-10T18:00:00.000Z'

for tenant, course, title in [
    ('T1','C1','Irrigação Inteligente'),('T1','C2','IoT Oculto no White Label'),('T2','C3','Irrigação Outro Tenant')
]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?,'published',0,0,1,'ADMIN','ADMIN',?,?)''',
      (course,tenant,title,'Conteúdo acadêmico',now,now))

for tenant, course, slug, category, featured in [
    ('T1','C1','irrigacao-inteligente','Irrigação',1),
    ('T1','C2','iot-oculto','Tecnologia',0),
    ('T2','C3','irrigacao-outro','Irrigação',1),
]:
    conn.execute('''INSERT INTO academy_course_public_profiles
      (course_id,tenant_id,slug,category,short_description,level_label,visibility,access_model,currency,featured,updated_by,created_at,updated_at)
      VALUES (?,?,?,?,?,'Intermediário','public','free','BRL',?,'ADMIN',?,?)''',
      (course,tenant,slug,category,'Formação prática no agro',featured,now,now))

# White Label T1 exposes only C1; every course-backed projection must respect it.
conn.execute('''INSERT INTO academy_white_label_settings
  (tenant_id,brand_name,academy_name,primary_color,secondary_color,accent_color,catalog_mode,status,updated_by,created_at,updated_at)
  VALUES ('T1','Marca T1','Academy T1','#004E3B','#087A51','#00825B','selected_courses','active','ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_white_label_catalog_courses
  (tenant_id,course_id,visible,featured,updated_by,updated_at)
  VALUES ('T1','C1',1,1,'ADMIN',?)''',(now,))

# Public path backed by visible C1.
conn.execute('''INSERT INTO academy_public_learning_paths
  (id,tenant_id,slug,title,description,category,visibility,featured,access_model,currency,created_by,created_at,updated_at)
  VALUES ('P1','T1','trilha-irrigacao','Trilha de Irrigação','Formação progressiva','Irrigação','hidden',1,'free','BRL','ADMIN',?,?)''',(now,now))
conn.execute("INSERT INTO academy_public_learning_path_courses (id,tenant_id,path_id,course_id,position,created_at) VALUES ('PC1','T1','P1','C1',0,?)",(now,))
conn.execute("UPDATE academy_public_learning_paths SET visibility='public' WHERE id='P1'")

# Instructor public projection stores only public-safe profile data.
conn.execute('''INSERT INTO academy_instructors
  (id,tenant_id,user_id,display_name_snapshot,bio,status,created_by,created_at,updated_at)
  VALUES ('I1','T1','U1','Ana Irrigação','Bio privada','active','ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_instructor_public_profiles
  (instructor_id,tenant_id,slug,visibility,headline,short_bio,public_specialties_json,credential_summary,featured,created_by,created_at,updated_at)
  VALUES ('I1','T1','ana-irrigacao','public','Especialista em irrigação','Atuação prática','["Irrigação","Agronomia"]','Perfil público aprovado',1,'ADMIN',?,?)''',(now,now))

# Future public event.
conn.execute('''INSERT INTO academy_events
  (id,tenant_id,title,description,event_type,modality,status,access_model,price_cents,currency,starts_at,ends_at,timezone,smart_farm_experience,created_by,published_at,created_at,updated_at)
  VALUES ('E1','T1','Dia de Campo Irrigação','Prática na Smart Farm','field_day','in_person','published','sponsored',NULL,'BRL',?,?,'America/Sao_Paulo',1,'ADMIN',?,?,?)''',(future_start,future_end,now,now,now))
conn.execute('''INSERT INTO academy_events
  (id,tenant_id,title,description,event_type,modality,status,access_model,price_cents,currency,starts_at,ends_at,timezone,smart_farm_experience,created_by,published_at,created_at,updated_at)
  VALUES ('E2','T2','Evento Outro Tenant','Não pode vazar','webinar','online','published','free',NULL,'BRL',?,?,'America/Sao_Paulo',0,'ADMIN2',?,?,?)''',(future_start,future_end,now,now,now))

# Public free plan requires no fabricated payment setup.
conn.execute('''INSERT INTO academy_plans
  (id,tenant_id,slug,name,description,audience_type,commercial_mode,status,featured,created_by,created_at,updated_at)
  VALUES ('PL1','T1','plano-academy','Plano Academy','Capacitação individual','individual','free','public',1,'ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_plans
  (id,tenant_id,slug,name,description,audience_type,commercial_mode,status,featured,created_by,created_at,updated_at)
  VALUES ('PL2','T2','plano-outro','Plano Outro Tenant','Não pode vazar','individual','free','public',0,'ADMIN2',?,?)''',(now,now))

course_rows = conn.execute('''
  SELECT c.id FROM academy_course_public_profiles p
  JOIN academy_courses c ON c.id=p.course_id AND c.tenant_id=p.tenant_id AND c.status='published'
  LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=c.tenant_id AND ws.status='active'
  LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=c.tenant_id AND wc.course_id=c.id AND wc.visible=1
  WHERE p.tenant_id='T1' AND p.visibility='public'
    AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
  ORDER BY c.id
''').fetchall()
assert [row['id'] for row in course_rows] == ['C1']

path_rows = conn.execute('''
  SELECT p.id FROM academy_public_learning_paths p
  WHERE p.tenant_id='T1' AND p.visibility='public' AND EXISTS (
    SELECT 1 FROM academy_public_learning_path_courses pc
    JOIN academy_courses c ON c.tenant_id=pc.tenant_id AND c.id=pc.course_id AND c.status='published'
    JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id AND cp.visibility='public'
    LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=pc.tenant_id AND ws.status='active'
    LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=pc.tenant_id AND wc.course_id=pc.course_id AND wc.visible=1
    WHERE pc.tenant_id=p.tenant_id AND pc.path_id=p.id
      AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
  )
''').fetchall()
assert [row['id'] for row in path_rows] == ['P1']

instructor_rows = conn.execute("SELECT instructor_id FROM academy_instructor_public_profiles WHERE tenant_id='T1' AND visibility='public'").fetchall()
assert [row['instructor_id'] for row in instructor_rows] == ['I1']

event_rows = conn.execute("SELECT id FROM academy_events WHERE tenant_id='T1' AND status='published' AND datetime(ends_at)>=datetime('now') ORDER BY id").fetchall()
assert [row['id'] for row in event_rows] == ['E1']

plan_rows = conn.execute("SELECT id FROM academy_plans WHERE tenant_id='T1' AND status='public' ORDER BY id").fetchall()
assert [row['id'] for row in plan_rows] == ['PL1']

# Unified source set contains no hidden course and no entity from T2.
ids = {row['id'] for row in course_rows + path_rows + event_rows + plan_rows}
ids.update(row['instructor_id'] for row in instructor_rows)
assert ids == {'C1','P1','I1','E1','PL1'}
assert not ({'C2','C3','E2','PL2'} & ids)

violations = conn.execute('PRAGMA foreign_key_check').fetchall()
assert not violations, violations
conn.close()
print('Unified public search integration fixture: PASS')
