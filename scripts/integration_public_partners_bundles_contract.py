from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.row_factory = sqlite3.Row
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-11T12:00:00.000Z'

for tenant, course, title in [('T1','C1','Curso Visível'),('T1','C3','Curso Fora do White Label'),('T2','C2','Curso Outro Tenant')]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?,'published',0,0,1,'ADMIN','ADMIN',?,?)''',(course,tenant,title,'Descrição',now,now))
    conn.execute('''INSERT INTO academy_course_public_profiles
      (course_id,tenant_id,slug,visibility,access_model,currency,featured,updated_by,created_at,updated_at)
      VALUES (?,?,?,'public','free','BRL',0,'ADMIN',?,?)''',(course,tenant,f'curso-{course.lower()}',now,now))

conn.execute('''INSERT INTO academy_white_label_settings
  (tenant_id,brand_name,academy_name,primary_color,secondary_color,accent_color,catalog_mode,status,updated_by,created_at,updated_at)
  VALUES ('T1','Marca','Academy','#004E3B','#087A51','#00825B','selected_courses','active','ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_white_label_catalog_courses
  (tenant_id,course_id,visible,featured,updated_by,updated_at) VALUES ('T1','C1',1,1,'ADMIN',?)''',(now,))

conn.execute('''INSERT INTO academy_public_partners
  (id,tenant_id,slug,display_name,description,partner_type,source_system,external_ref,status,featured,created_by,updated_by,created_at,updated_at)
  VALUES ('P1','T1','parceiro-tech','Parceiro Tech','Tecnologia aplicada','technology','ifarm_core','PARTNER-1','public',1,'ADMIN','ADMIN',?,?)''',(now,now))

# Empty bundle cannot become public.
conn.execute('''INSERT INTO academy_public_bundles
  (id,tenant_id,slug,title,description,status,featured,commercial_mode,currency,created_by,updated_by,created_at,updated_at)
  VALUES ('B0','T1','vazio','Bundle Vazio','','hidden',0,'free','BRL','ADMIN','ADMIN',?,?)''',(now,now))
try:
    conn.execute("UPDATE academy_public_bundles SET status='public' WHERE id='B0'")
    raise AssertionError('empty bundle was published')
except sqlite3.IntegrityError:
    pass

# Priced bundle requires a positive amount.
try:
    conn.execute('''INSERT INTO academy_public_bundles
      (id,tenant_id,slug,title,status,commercial_mode,list_price_cents,currency,created_by,created_at,updated_at)
      VALUES ('BP','T1','preco-invalido','Preço inválido','hidden','priced',0,'BRL','ADMIN',?,?)''',(now,now))
    raise AssertionError('invalid priced bundle was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_public_bundles
  (id,tenant_id,slug,title,description,status,featured,commercial_mode,currency,created_by,updated_by,created_at,updated_at)
  VALUES ('B1','T1','bundle-smart','Bundle Smart','Educação + ecossistema','hidden',1,'contact_sales','BRL','ADMIN','ADMIN',?,?)''',(now,now))

# Cross-tenant course cannot enter bundle T1.
try:
    conn.execute("INSERT INTO academy_public_bundle_courses (id,tenant_id,bundle_id,course_id,position,created_at) VALUES ('BCX','T1','B1','C2',0,?)",(now,))
    raise AssertionError('cross-tenant course was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute("INSERT INTO academy_public_bundle_courses (id,tenant_id,bundle_id,course_id,position,created_at) VALUES ('BC1','T1','B1','C1',0,?)",(now,))
conn.execute("INSERT INTO academy_public_bundle_external_items (id,tenant_id,bundle_id,source_system,external_ref,label,description,item_type,position,created_at) VALUES ('BE1','T1','B1','ifarm_store','SKU-1','Kit de sensores','Referência externa','product',1,?)",(now,))
conn.execute("INSERT INTO academy_public_bundle_partners (id,tenant_id,bundle_id,partner_id,position,created_at) VALUES ('BPR1','T1','B1','P1',0,?)",(now,))
conn.execute("UPDATE academy_public_bundles SET status='public' WHERE id='B1'")

# Published composition is locked even for direct SQL writes.
for sql, params in [
    ("INSERT INTO academy_public_bundle_external_items (id,tenant_id,bundle_id,source_system,external_ref,label,item_type,position,created_at) VALUES ('BE2','T1','B1','ifarm_services','SVC-1','Consultoria','service',2,?)",(now,)),
    ("DELETE FROM academy_public_bundle_courses WHERE id='BC1'",()),
    ("UPDATE academy_public_bundle_external_items SET label='Alterado' WHERE id='BE1'",()),
]:
    try:
        conn.execute(sql, params)
        raise AssertionError('published bundle composition was mutated')
    except sqlite3.IntegrityError:
        pass

# Bundle and partner reference identities are immutable.
try:
    conn.execute("UPDATE academy_public_bundles SET tenant_id='T2' WHERE id='B1'")
    raise AssertionError('bundle tenant was changed')
except sqlite3.IntegrityError:
    pass
try:
    conn.execute("UPDATE academy_public_partners SET external_ref='OTHER' WHERE id='P1'")
    raise AssertionError('partner external reference was changed')
except sqlite3.IntegrityError:
    pass

# A bundle backed only by a course excluded from White Label can be editorially public,
# but must not appear in the resolved public portal for this host.
conn.execute('''INSERT INTO academy_public_bundles
  (id,tenant_id,slug,title,status,featured,commercial_mode,currency,created_by,updated_by,created_at,updated_at)
  VALUES ('B2','T1','bundle-oculto','Bundle fora do catálogo','hidden',0,'free','BRL','ADMIN','ADMIN',?,?)''',(now,now))
conn.execute("INSERT INTO academy_public_bundle_courses (id,tenant_id,bundle_id,course_id,position,created_at) VALUES ('BC3','T1','B2','C3',0,?)",(now,))
conn.execute("UPDATE academy_public_bundles SET status='public' WHERE id='B2'")

visible = conn.execute('''
  SELECT b.id FROM academy_public_bundles b
  WHERE b.tenant_id='T1' AND b.status='public' AND (
    EXISTS (SELECT 1 FROM academy_public_bundle_external_items ex WHERE ex.tenant_id=b.tenant_id AND ex.bundle_id=b.id)
    OR EXISTS (
      SELECT 1 FROM academy_public_bundle_courses cx
      JOIN academy_courses c ON c.id=cx.course_id AND c.tenant_id=cx.tenant_id AND c.status='published'
      JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
      LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=cx.tenant_id AND ws.status='active'
      LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=cx.tenant_id AND wc.course_id=cx.course_id AND wc.visible=1
      WHERE cx.tenant_id=b.tenant_id AND cx.bundle_id=b.id
        AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
    )
  ) ORDER BY b.id
''').fetchall()
assert [row['id'] for row in visible] == ['B1']

partners = conn.execute("SELECT id FROM academy_public_partners WHERE tenant_id='T1' AND status='public'").fetchall()
assert [row['id'] for row in partners] == ['P1']
assert not conn.execute("SELECT 1 FROM academy_public_partners WHERE tenant_id='T2' AND id='P1'").fetchone()

violations = conn.execute('PRAGMA foreign_key_check').fetchall()
assert not violations, violations
conn.close()
print('Public partners and bundles integration fixture: PASS')
