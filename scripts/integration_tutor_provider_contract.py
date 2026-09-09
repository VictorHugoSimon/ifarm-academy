from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-09T18:00:00.000Z'

conn.execute('''INSERT INTO academy_courses
  (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
  VALUES ('C1','T1','Irrigação','Curso publicado','published',0,0,1,'A1','A1',?,?)''', (now, now))
conn.execute('''INSERT INTO academy_course_modules
  (id,tenant_id,course_id,title,description,position,created_at,updated_at)
  VALUES ('M1','T1','C1','Módulo','',0,?,?)''', (now, now))
conn.execute('''INSERT INTO academy_course_lessons
  (id,tenant_id,course_id,module_id,title,content_type,duration_minutes,required,position,content_json,created_at,updated_at)
  VALUES ('L1','T1','C1','M1','Pressão','text',20,1,0,'{"body":"Verifique pressão e vazão."}',?,?)''', (now, now))
conn.execute('''INSERT INTO academy_tutor_course_policies
  (tenant_id,course_id,enabled,approved_by,approved_at,last_indexed_at,last_indexed_course_updated_at,created_at,updated_at)
  VALUES ('T1','C1',1,'ADMIN1',?,?,?, ?,?)''', (now, now, now, now, now))

# Geração externa exige aprovação explícita e snapshot da versão publicada.
try:
    conn.execute("UPDATE academy_tutor_course_policies SET generative_enabled=1 WHERE tenant_id='T1' AND course_id='C1'")
    raise AssertionError('Generative policy enabled without explicit approval')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''UPDATE academy_tutor_course_policies
      SET generative_enabled=1,generative_approved_by='ADMIN1',generative_approved_at=?,
          generative_approved_course_updated_at='versao-incorreta',updated_at=?
      WHERE tenant_id='T1' AND course_id='C1' ''', (now, now))
    raise AssertionError('Generative policy accepted stale course version')
except sqlite3.IntegrityError:
    pass

conn.execute('''UPDATE academy_tutor_course_policies
  SET generative_enabled=1,generative_approved_by='ADMIN1',generative_approved_at=?,
      generative_approved_course_updated_at=?,generative_disabled_at=NULL,updated_at=?
  WHERE tenant_id='T1' AND course_id='C1' ''', (now, now, now))
assert conn.execute("SELECT generative_enabled FROM academy_tutor_course_policies WHERE tenant_id='T1' AND course_id='C1'").fetchone()[0] == 1

conn.execute('''INSERT INTO academy_tutor_sessions
  (id,tenant_id,student_id,course_id,title,status,created_at,updated_at)
  VALUES ('S1','T1','U1','C1','Pergunta','active',?,?)''', (now, now))
conn.execute('''INSERT INTO academy_tutor_provider_events
  (id,tenant_id,session_id,student_id,course_id,provider_mode,outcome,latency_ms,evidence_count,
   citation_count,request_chars,response_chars,fallback_reason,created_at)
  VALUES ('E1','T1','S1','U1','C1','gateway_v1','success',120,2,1,800,250,NULL,?)''', (now,))

# Evento precisa pertencer ao mesmo tenant/aluno/curso da sessão.
try:
    conn.execute('''INSERT INTO academy_tutor_provider_events
      (id,tenant_id,session_id,student_id,course_id,provider_mode,outcome,latency_ms,evidence_count,
       citation_count,request_chars,response_chars,fallback_reason,created_at)
      VALUES ('BAD','T2','S1','U1','C1','gateway_v1','provider_error',1,1,0,10,0,'x',?)''', (now,))
    raise AssertionError('Cross-tenant provider event accepted')
except sqlite3.IntegrityError:
    pass

# Observabilidade é append-only.
try:
    conn.execute("UPDATE academy_tutor_provider_events SET outcome='provider_error' WHERE id='E1'")
    raise AssertionError('Provider event update accepted')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute("DELETE FROM academy_tutor_provider_events WHERE id='E1'")
    raise AssertionError('Provider event delete accepted')
except sqlite3.IntegrityError:
    pass

# Despublicar revoga geração externa e remove fontes pelo contrato v0.57.
conn.execute("UPDATE academy_courses SET status='draft',updated_at='2026-09-09T18:10:00.000Z' WHERE tenant_id='T1' AND id='C1'")
row = conn.execute("SELECT generative_enabled,generative_disabled_at FROM academy_tutor_course_policies WHERE tenant_id='T1' AND course_id='C1'").fetchone()
assert row[0] == 0
assert row[1] is not None

# Mesmo reabilitando conteúdo, geração não volta automaticamente.
conn.execute("UPDATE academy_courses SET status='published',updated_at='2026-09-09T18:20:00.000Z' WHERE tenant_id='T1' AND id='C1'")
row = conn.execute("SELECT generative_enabled FROM academy_tutor_course_policies WHERE tenant_id='T1' AND course_id='C1'").fetchone()
assert row[0] == 0

conn.close()
print('AI Tutor provider governance integration fixture: PASS')
