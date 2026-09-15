from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.row_factory = sqlite3.Row
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-11T15:00:00.000Z'

for tenant, course, title, visibility in [
    ('T1','C1','Curso Curado','public'),
    ('T1','C3','Curso fora White Label','public'),
    ('T1','C4','Curso oculto','hidden'),
    ('T2','C2','Curso outro tenant','public'),
]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?,'published',0,0,1,'ADMIN','ADMIN',?,?)''',(course,tenant,title,'Descrição',now,now))
    conn.execute('''INSERT INTO academy_course_public_profiles
      (course_id,tenant_id,slug,visibility,access_model,currency,featured,updated_by,created_at,updated_at)
      VALUES (?,?,?,?, 'free','BRL',0,'ADMIN',?,?)''',(course,tenant,f'curso-{course.lower()}',visibility,now,now))

conn.execute('''INSERT INTO academy_white_label_settings
  (tenant_id,brand_name,academy_name,primary_color,secondary_color,accent_color,catalog_mode,status,updated_by,created_at,updated_at)
  VALUES ('T1','Marca','Academy','#004E3B','#087A51','#00825B','selected_courses','active','ADMIN',?,?)''',(now,now))
conn.execute("INSERT INTO academy_white_label_catalog_courses (tenant_id,course_id,visible,featured,updated_by,updated_at) VALUES ('T1','C1',1,1,'ADMIN',?)",(now,))

# Bloco vazio não pode ser publicado.
conn.execute('''INSERT INTO academy_public_recommendation_sets
  (id,tenant_id,recommendation_key,title,surface,context_ref,status,priority,created_by,updated_by,created_at,updated_at)
  VALUES ('S0','T1','vazio','Vazio','home','','hidden',0,'ADMIN','ADMIN',?,?)''',(now,now))
try:
    conn.execute("UPDATE academy_public_recommendation_sets SET status='public' WHERE id='S0'")
    raise AssertionError('empty recommendation set was published')
except sqlite3.IntegrityError:
    pass

# Cross-tenant não entra nem em bloco oculto.
conn.execute('''INSERT INTO academy_public_recommendation_sets
  (id,tenant_id,recommendation_key,title,surface,context_ref,status,priority,created_by,updated_by,created_at,updated_at)
  VALUES ('SX','T1','cross','Cross','home','','hidden',0,'ADMIN','ADMIN',?,?)''',(now,now))
try:
    conn.execute("INSERT INTO academy_public_recommendation_items (id,tenant_id,set_id,item_type,item_ref,position,created_at) VALUES ('IX','T1','SX','course','C2',0,?)",(now,))
    raise AssertionError('cross-tenant recommendation item was accepted')
except sqlite3.IntegrityError:
    pass

# Item oculto não pode compor bloco público.
conn.execute("INSERT INTO academy_public_recommendation_items (id,tenant_id,set_id,item_type,item_ref,position,created_at) VALUES ('I4','T1','SX','course','C4',0,?)",(now,))
try:
    conn.execute("UPDATE academy_public_recommendation_sets SET status='public' WHERE id='SX'")
    raise AssertionError('hidden course recommendation was published')
except sqlite3.IntegrityError:
    pass

# Curadoria Home válida e ordem determinística.
conn.execute('''INSERT INTO academy_public_recommendation_sets
  (id,tenant_id,recommendation_key,title,subtitle,surface,context_ref,status,priority,created_by,updated_by,created_at,updated_at)
  VALUES ('S1','T1','agro-digital','Escolhas da Academy','Curadoria editorial','home','','hidden',10,'ADMIN','ADMIN',?,?)''',(now,now))
conn.execute("INSERT INTO academy_public_recommendation_items (id,tenant_id,set_id,item_type,item_ref,editorial_label,position,created_at) VALUES ('I1','T1','S1','course','C1','Em destaque',0,?)",(now,))
conn.execute("INSERT INTO academy_public_recommendation_items (id,tenant_id,set_id,item_type,item_ref,position,created_at) VALUES ('I3','T1','S1','course','C3',1,?)",(now,))
conn.execute("UPDATE academy_public_recommendation_sets SET status='public' WHERE id='S1'")

# Composição publicada é travada.
for sql, params in [
    ("DELETE FROM academy_public_recommendation_items WHERE id='I1'",()),
    ("UPDATE academy_public_recommendation_items SET position=4 WHERE id='I1'",()),
    ("INSERT INTO academy_public_recommendation_items (id,tenant_id,set_id,item_type,item_ref,position,created_at) VALUES ('I5','T1','S1','course','C4',2,?)",(now,)),
]:
    try:
        conn.execute(sql, params)
        raise AssertionError('published recommendation composition was mutated')
    except sqlite3.IntegrityError:
        pass

# Contexto oculto não pode ser publicado.
conn.execute('''INSERT INTO academy_public_recommendation_sets
  (id,tenant_id,recommendation_key,title,surface,context_ref,status,priority,created_by,updated_by,created_at,updated_at)
  VALUES ('SC','T1','relacionados','Relacionados','course','C4','hidden',0,'ADMIN','ADMIN',?,?)''',(now,now))
conn.execute("INSERT INTO academy_public_recommendation_items (id,tenant_id,set_id,item_type,item_ref,position,created_at) VALUES ('IC','T1','SC','course','C1',0,?)",(now,))
try:
    conn.execute("UPDATE academy_public_recommendation_sets SET status='public' WHERE id='SC'")
    raise AssertionError('recommendation with hidden context was published')
except sqlite3.IntegrityError:
    pass

# White Label é aplicado na leitura: C3 pode existir editorialmente, mas não pode ser resolvido neste host.
visible_items = conn.execute('''SELECT i.item_ref FROM academy_public_recommendation_items i
  JOIN academy_courses c ON c.id=i.item_ref AND c.tenant_id=i.tenant_id AND c.status='published'
  JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
  LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=i.tenant_id AND ws.status='active'
  LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=i.tenant_id AND wc.course_id=i.item_ref AND wc.visible=1
  WHERE i.tenant_id='T1' AND i.set_id='S1' AND i.item_type='course'
    AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
  ORDER BY i.position''').fetchall()
assert [row['item_ref'] for row in visible_items] == ['C1']

# Não existe identidade comportamental/visitante no modelo de curadoria.
for table in ('academy_public_recommendation_sets','academy_public_recommendation_items'):
    columns={row['name'] for row in conn.execute(f'PRAGMA table_info({table})').fetchall()}
    forbidden={'user_id','student_id','visitor_id','session_id','behavior_profile','browsing_history','lead_id','opportunity_id'}
    assert not (columns & forbidden), (table, columns & forbidden)

sets=conn.execute("SELECT recommendation_key FROM academy_public_recommendation_sets WHERE tenant_id='T1' AND status='public' ORDER BY priority,recommendation_key").fetchall()
assert [row['recommendation_key'] for row in sets] == ['agro-digital']
assert not conn.execute("SELECT 1 FROM academy_public_recommendation_sets WHERE tenant_id='T2' AND id='S1'").fetchone()
violations=conn.execute('PRAGMA foreign_key_check').fetchall()
assert not violations, violations
conn.close()
print('Editorial recommendations integration fixture: PASS')
