from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-08T15:45:00.000Z'

for tenant, course in [('T1','C1'),('T2','C2')]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?, 'published',0,0,1,'ADMIN','ADMIN',?,?)''',
      (course,tenant,f'Curso {course}','Descrição',now,now))

conn.execute('''INSERT INTO academy_course_modules
  (id,tenant_id,course_id,title,description,position,created_at,updated_at)
  VALUES ('M1','T1','C1','Irrigação','Módulo autorizado',0,?,?)''', (now,now))
conn.execute('''INSERT INTO academy_course_lessons
  (id,tenant_id,course_id,module_id,title,content_type,duration_minutes,required,position,content_json,created_at,updated_at)
  VALUES ('L1','T1','C1','M1','Umidade do solo','text',10,1,0,'{"body":"Sensores de umidade apoiam decisões de irrigação."}',?,?)''', (now,now))

conn.execute('''INSERT INTO academy_enrollments
  (id,tenant_id,course_id,student_id,student_name_snapshot,source,status,enrolled_at,updated_at)
  VALUES ('E1','T1','C1','U1','Aluno 1','academy','active',?,?)''', (now,now))

conn.execute('''INSERT INTO academy_tutor_sessions
  (id,tenant_id,user_id,course_id,status,created_at,updated_at,last_message_at)
  VALUES ('S1','T1','U1','C1','active',?,?,?)''', (now,now,now))
conn.execute('''INSERT INTO academy_tutor_messages
  (id,session_id,tenant_id,user_id,course_id,role,content,response_mode,citations_json,created_at)
  VALUES ('MSG1','S1','T1','U1','C1','user','Como funciona a irrigação?','evidence_only','[]',?)''', (now,))

# A user without enrollment cannot open a tutor session.
try:
    conn.execute('''INSERT INTO academy_tutor_sessions
      (id,tenant_id,user_id,course_id,status,created_at,updated_at,last_message_at)
      VALUES ('S-NO-ENROLL','T1','U2','C1','active',?,?,?)''', (now,now,now))
    raise AssertionError('tutor session without enrollment was accepted')
except sqlite3.IntegrityError:
    pass

# Cross-tenant course cannot be attached to a T1 session.
try:
    conn.execute('''INSERT INTO academy_tutor_sessions
      (id,tenant_id,user_id,course_id,status,created_at,updated_at,last_message_at)
      VALUES ('S-CROSS','T1','U1','C2','active',?,?,?)''', (now,now,now))
    raise AssertionError('cross-tenant tutor session was accepted')
except sqlite3.IntegrityError:
    pass

# Session identity is immutable.
try:
    conn.execute("UPDATE academy_tutor_sessions SET user_id='U2' WHERE id='S1'")
    raise AssertionError('tutor session identity mutation was accepted')
except sqlite3.IntegrityError:
    pass

# Message must match the exact session scope.
try:
    conn.execute('''INSERT INTO academy_tutor_messages
      (id,session_id,tenant_id,user_id,course_id,role,content,response_mode,citations_json,created_at)
      VALUES ('MSG-CROSS','S1','T2','U1','C1','assistant','Resposta','evidence_only','[]',?)''', (now,))
    raise AssertionError('cross-tenant tutor message was accepted')
except sqlite3.IntegrityError:
    pass

# Messages are audit history and cannot be rewritten or deleted.
try:
    conn.execute("UPDATE academy_tutor_messages SET content='alterado' WHERE id='MSG1'")
    raise AssertionError('tutor message update was accepted')
except sqlite3.IntegrityError:
    pass
try:
    conn.execute("DELETE FROM academy_tutor_messages WHERE id='MSG1'")
    raise AssertionError('tutor message delete was accepted')
except sqlite3.IntegrityError:
    pass

# Archived conversations cannot receive new messages.
conn.execute("UPDATE academy_tutor_sessions SET status='archived',updated_at=? WHERE id='S1'", (now,))
try:
    conn.execute('''INSERT INTO academy_tutor_messages
      (id,session_id,tenant_id,user_id,course_id,role,content,response_mode,citations_json,created_at)
      VALUES ('MSG-ARCHIVED','S1','T1','U1','C1','user','Nova pergunta','evidence_only','[]',?)''', (now,))
    raise AssertionError('message in archived tutor session was accepted')
except sqlite3.IntegrityError:
    pass

count = conn.execute("SELECT COUNT(*) FROM academy_tutor_messages WHERE session_id='S1'").fetchone()[0]
assert count == 1

conn.close()
print('Tutor IA integration fixture: PASS')
