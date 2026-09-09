from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-09T16:30:00.000Z'

conn.execute('''INSERT INTO academy_courses
  (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
  VALUES ('C1','T1','Irrigação','Curso autorizado','published',0,0,1,'A1','A1',?,?)''', (now, now))
conn.execute('''INSERT INTO academy_course_modules
  (id,tenant_id,course_id,title,description,position,created_at,updated_at)
  VALUES ('M1','T1','C1','Módulo 1','',0,?,?)''', (now, now))
conn.execute('''INSERT INTO academy_course_lessons
  (id,tenant_id,course_id,module_id,title,content_type,duration_minutes,required,position,content_json,created_at,updated_at)
  VALUES ('L1','T1','C1','M1','Pressão e vazão','text',20,1,0,'{"body":"Pressão e vazão devem ser verificadas antes da operação."}',?,?)''', (now, now))

# Publicado não significa autorizado para IA.
try:
    conn.execute('''INSERT INTO academy_tutor_source_chunks
      (id,tenant_id,course_id,lesson_id,chunk_index,source_title,source_type,content_text,content_hash,indexed_at)
      VALUES ('PRE','T1','C1','L1',0,'Pressão','lesson_body','Não deve entrar','prehash',?)''', (now,))
    raise AssertionError('Tutor chunk was accepted without explicit policy')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''INSERT INTO academy_tutor_sessions
      (id,tenant_id,student_id,course_id,title,status,created_at,updated_at)
      VALUES ('PRESESSION','T1','U1','C1','Sem autorização','active',?,?)''', (now, now))
    raise AssertionError('Tutor session was accepted without explicit policy')
except sqlite3.IntegrityError:
    pass

# Habilitar sem responsável/data de aprovação é inválido.
try:
    conn.execute('''INSERT INTO academy_tutor_course_policies
      (tenant_id,course_id,enabled,approved_by,approved_at,created_at,updated_at)
      VALUES ('T1','C1',1,NULL,NULL,?,?)''', (now, now))
    raise AssertionError('Tutor policy was enabled without approval evidence')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_tutor_course_policies
  (tenant_id,course_id,enabled,approved_by,approved_at,disabled_at,last_indexed_at,last_indexed_course_updated_at,created_at,updated_at)
  VALUES ('T1','C1',1,'ADMIN1',?,NULL,?,? ,?,?)''', (now, now, now, now, now))

conn.execute('''INSERT INTO academy_tutor_source_chunks
  (id,tenant_id,course_id,lesson_id,chunk_index,source_title,source_type,content_text,content_hash,indexed_at)
  VALUES ('CH1','T1','C1','L1',0,'Pressão e vazão','lesson_body','Pressão e vazão devem ser verificadas antes da operação.','hash1',?)''', (now,))
conn.execute('''INSERT INTO academy_tutor_sessions
  (id,tenant_id,student_id,course_id,title,status,created_at,updated_at)
  VALUES ('S1','T1','U1','C1','Como funciona a pressão?','active',?,?)''', (now, now))
conn.execute('''INSERT INTO academy_tutor_messages
  (id,tenant_id,session_id,student_id,role,mode,content_text,citations_json,provider,created_at)
  VALUES ('MSG1','T1','S1','U1','assistant','evidence_only','Resposta limitada às evidências.','[{"chunkId":"CH1"}]',NULL,?)''', (now,))

# A fonte não pode atravessar tenant/curso/aula.
try:
    conn.execute('''INSERT INTO academy_tutor_source_chunks
      (id,tenant_id,course_id,lesson_id,chunk_index,source_title,source_type,content_text,content_hash,indexed_at)
      VALUES ('BAD1','T2','C1','L1',0,'Inválido','lesson_body','Não pode entrar','hash2',?)''', (now,))
    raise AssertionError('cross-tenant tutor chunk was accepted')
except sqlite3.IntegrityError:
    pass

# A identidade tenant/curso da política é imutável.
try:
    conn.execute("UPDATE academy_tutor_course_policies SET tenant_id='T2' WHERE tenant_id='T1' AND course_id='C1'")
    raise AssertionError('Tutor policy identity mutation was accepted')
except sqlite3.IntegrityError:
    pass

# Desautorizar remove imediatamente o índice e bloqueia novas fontes/sessões.
conn.execute("UPDATE academy_tutor_course_policies SET enabled=0,disabled_at=?,updated_at=? WHERE tenant_id='T1' AND course_id='C1'", (now, now))
assert conn.execute("SELECT COUNT(*) FROM academy_tutor_source_chunks WHERE tenant_id='T1' AND course_id='C1'").fetchone()[0] == 0

try:
    conn.execute('''INSERT INTO academy_tutor_source_chunks
      (id,tenant_id,course_id,lesson_id,chunk_index,source_title,source_type,content_text,content_hash,indexed_at)
      VALUES ('BAD2','T1','C1','L1',0,'Bloqueado','lesson_body','Não pode entrar','hash3',?)''', (now,))
    raise AssertionError('Tutor chunk was accepted after policy disable')
except sqlite3.IntegrityError:
    pass

# Reautorizar permite novo índice; tirar o curso de published purga novamente.
conn.execute("UPDATE academy_tutor_course_policies SET enabled=1,approved_by='ADMIN1',approved_at=?,disabled_at=NULL,updated_at=? WHERE tenant_id='T1' AND course_id='C1'", (now, now))
conn.execute('''INSERT INTO academy_tutor_source_chunks
  (id,tenant_id,course_id,lesson_id,chunk_index,source_title,source_type,content_text,content_hash,indexed_at)
  VALUES ('CH2','T1','C1','L1',0,'Pressão e vazão','lesson_body','Novo índice autorizado.','hash4',?)''', (now,))
assert conn.execute("SELECT COUNT(*) FROM academy_tutor_source_chunks WHERE tenant_id='T1' AND course_id='C1'").fetchone()[0] == 1
conn.execute("UPDATE academy_courses SET status='archived',updated_at=? WHERE tenant_id='T1' AND id='C1'", (now,))
assert conn.execute("SELECT COUNT(*) FROM academy_tutor_source_chunks WHERE tenant_id='T1' AND course_id='C1'").fetchone()[0] == 0

# Mensagem histórica continua auditável mesmo após revogar/unpublicar.
row = conn.execute("SELECT student_id,mode FROM academy_tutor_messages WHERE id='MSG1'").fetchone()
assert row == ('U1', 'evidence_only')

conn.close()
print('AI Tutor governance integration fixture: PASS')
