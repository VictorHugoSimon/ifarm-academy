from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-06T21:45:00.000Z'

conn.execute('''INSERT INTO academy_notifications
  (id,tenant_id,user_id,category,notification_type,title,message,priority,status,required,source_type,source_id,dedupe_key,payload_json,created_at)
  VALUES ('N1','T1','U1','academic','course_completed','Curso concluído','Parabéns','important','unread',0,'learning_cycle','LC1','course:LC1','{}',?)''', (now,))

# Dedupe must prevent the same event from being inserted twice for the same user.
try:
    conn.execute('''INSERT INTO academy_notifications
      (id,tenant_id,user_id,category,notification_type,title,message,priority,status,required,dedupe_key,payload_json,created_at)
      VALUES ('N2','T1','U1','academic','course_completed','Duplicada','Não deve entrar','normal','unread',0,'course:LC1','{}',?)''', (now,))
    raise AssertionError('duplicate notification was accepted')
except sqlite3.IntegrityError:
    pass

# Read status requires read_at.
try:
    conn.execute("UPDATE academy_notifications SET status='read' WHERE id='N1'")
    raise AssertionError('read notification without read_at was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute("UPDATE academy_notifications SET status='read',read_at=? WHERE id='N1'", (now,))

# Notification identity is immutable.
try:
    conn.execute("UPDATE academy_notifications SET user_id='U2' WHERE id='N1'")
    raise AssertionError('notification identity mutation was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_notification_preferences
  (tenant_id,user_id,category,in_app_enabled,email_enabled,push_enabled,updated_at)
  VALUES ('T1','U1','academic',0,0,0,?)''', (now,))

# External channels remain structurally disabled in v0.38.
try:
    conn.execute("UPDATE academy_notification_preferences SET email_enabled=1 WHERE tenant_id='T1' AND user_id='U1' AND category='academic'")
    raise AssertionError('email channel was enabled without provider integration')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''INSERT INTO academy_notification_preferences
      (tenant_id,user_id,category,in_app_enabled,email_enabled,push_enabled,updated_at)
      VALUES ('T1','U1','event',1,0,1,?)''', (now,))
    raise AssertionError('push channel was enabled without provider integration')
except sqlite3.IntegrityError:
    pass

status = conn.execute("SELECT status,read_at FROM academy_notifications WHERE id='N1'").fetchone()
assert status == ('read', now)
pref = conn.execute("SELECT in_app_enabled,email_enabled,push_enabled FROM academy_notification_preferences WHERE tenant_id='T1' AND user_id='U1' AND category='academic'").fetchone()
assert pref == (0,0,0)

conn.close()
print('Notifications integration fixture: PASS')
