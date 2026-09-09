from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-09T15:00:00.000Z'

conn.execute('''INSERT INTO academy_courses
  (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
  VALUES ('C1','T1','Irrigação','Curso autorizado','published',0,0,1,'A1','A1',?,?)''', (now, now))
conn.execute('''INSERT INTO academy_course_modules
  (id,tenant_id,course_id,title,description,position,created_at,updated_at)
  VALUES ('M1','T1','C1','Módulo 1','',0,?,?)''', (now, now))
conn.execute('''INSERT INTO academy_course_lessons
  (id,tenant_id,course_id,module_id,title,content_type,duration_minutes,required,position,content_json,created_at,updated_at)
  VALUES ('L1','T1','C1','M1','Pressão e vazão','text',20,1,0,'{"body":"Pressão e vazão devem ser verificadas antes da operação."}',?,?)''', (now, now))

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

# A sessão só pode apontar para curso publicado no mesmo tenant.
conn.execute('''INSERT INTO academy_courses
  (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
  VALUES ('C2','T1','Rascunho','', 'draft',0,0,1,'A1','A1',?,?)''', (now, now))
try:
    conn.execute('''INSERT INTO academy_tutor_sessions
      (id,tenant_id,student_id,course_id,title,status,created_at,updated_at)
      VALUES ('BAD2','T1','U1','C2','Não deve abrir','active',?,?)''', (now, now))
    raise AssertionError('draft course tutor session was accepted')
except sqlite3.IntegrityError:
    pass

# Mensagem não pode trocar o aluno da sessão.
try:
    conn.execute('''INSERT INTO academy_tutor_messages
      (id,tenant_id,session_id,student_id,role,mode,content_text,citations_json,provider,created_at)
      VALUES ('BAD3','T1','S1','U2','user','user_input','Pergunta inválida','[]',NULL,?)''', (now,))
    raise AssertionError('message with different student was accepted')
except sqlite3.IntegrityError:
    pass

row = conn.execute('''SELECT s.student_id,c.content_text,m.mode
  FROM academy_tutor_sessions s
  JOIN academy_tutor_messages m ON m.session_id=s.id
  JOIN academy_tutor_source_chunks c ON c.id='CH1'
  WHERE s.id='S1' AND m.id='MSG1' ''').fetchone()
assert row == ('U1', 'Pressão e vazão devem ser verificadas antes da operação.', 'evidence_only')

conn.close()
print('AI Tutor integration fixture: PASS')
