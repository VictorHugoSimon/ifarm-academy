from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-14T18:00:00.000Z'
for course in ('C1','C2'):
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,'T1',?,'Descrição','published',0,0,1,'ADMIN','ADMIN',?,?)''',(course,f'Curso {course}',now,now))
    conn.execute('''INSERT INTO academy_course_public_profiles
      (course_id,tenant_id,slug,visibility,access_model,currency,featured,updated_by,created_at,updated_at)
      VALUES (?,'T1',?,'public','free','BRL',0,'ADMIN',?,?)''',(course,course.lower(),now,now))

conn.execute('''INSERT INTO academy_white_label_settings
  (tenant_id,brand_name,academy_name,primary_color,secondary_color,accent_color,catalog_mode,status,updated_by,created_at,updated_at)
  VALUES ('T1','Marca','Academy','#004E3B','#087A51','#00825B','selected_courses','active','ADMIN',?,?)''',(now,now))
conn.execute("INSERT INTO academy_white_label_catalog_courses (tenant_id,course_id,visible,featured,updated_by,updated_at) VALUES ('T1','C1',1,1,'ADMIN',?)",(now,))

visible=conn.execute('''SELECT cp.slug FROM academy_course_public_profiles cp
  JOIN academy_courses c ON c.id=cp.course_id AND c.tenant_id=cp.tenant_id AND c.status='published'
  LEFT JOIN academy_white_label_settings ws ON ws.tenant_id=cp.tenant_id AND ws.status='active'
  LEFT JOIN academy_white_label_catalog_courses wc ON wc.tenant_id=cp.tenant_id AND wc.course_id=cp.course_id AND wc.visible=1
  WHERE cp.tenant_id='T1' AND cp.visibility='public'
    AND (ws.catalog_mode IS NULL OR ws.catalog_mode='all_tenant_courses' OR wc.course_id IS NOT NULL)
  ORDER BY cp.slug''').fetchall()
assert visible == [('c1',)], visible

sitemap_source=(ROOT/'functions'/'sitemap.xml.ts').read_text(encoding='utf-8')
robots_source=(ROOT/'functions'/'robots.txt.ts').read_text(encoding='utf-8')
helper_source=(ROOT/'functions'/'api'/'_publicSeo.ts').read_text(encoding='utf-8')
assert 'resolvePublicTenant' in sitemap_source
assert 'academy_white_label_catalog_courses' in sitemap_source
assert "path:'/app'" not in sitemap_source
assert "production" in robots_source and 'resolvePublicTenant' in robots_source
for private_route in ('/app','/api','/search','/certificates/validate','/smart-farm/checkin'):
    assert private_route in helper_source

conn.close()
print('Public SEO integration fixture: PASS')
