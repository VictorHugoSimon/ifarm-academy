from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-06T21:30:00.000Z'

conn.execute('''INSERT INTO academy_gamification_rules
  (id,tenant_id,event_type,points,status,version,rationale,configured_by,configured_at,created_at)
  VALUES ('R1','T1','lesson_completed',25,'active',1,'Regra aprovada','ADMIN',?,?)''', (now,now))
conn.execute('''INSERT INTO academy_gamification_rules
  (id,tenant_id,event_type,points,status,version,rationale,configured_by,configured_at,created_at)
  VALUES ('R2','T2','lesson_completed',10,'active',1,'Outro tenant','ADMIN2',?,?)''', (now,now))

conn.execute('''INSERT INTO academy_points_ledger
  (id,tenant_id,user_id,event_type,source_type,source_id,rule_id,points,occurred_at,created_at)
  VALUES ('L1','T1','U1','lesson_completed','lesson_cycle','LC1:L1','R1',25,?,?)''', (now,now))

# Same source/event/user must not award twice.
try:
    conn.execute('''INSERT INTO academy_points_ledger
      (id,tenant_id,user_id,event_type,source_type,source_id,rule_id,points,occurred_at,created_at)
      VALUES ('L2','T1','U1','lesson_completed','lesson_cycle','LC1:L1','R1',25,?,?)''', (now,now))
    raise AssertionError('duplicate XP award was accepted')
except sqlite3.IntegrityError:
    pass

# Ledger cannot reference a rule from another tenant.
try:
    conn.execute('''INSERT INTO academy_points_ledger
      (id,tenant_id,user_id,event_type,source_type,source_id,rule_id,points,occurred_at,created_at)
      VALUES ('BAD1','T1','U1','lesson_completed','lesson_cycle','LC1:L2','R2',10,?,?)''', (now,now))
    raise AssertionError('cross-tenant gamification rule was accepted')
except sqlite3.IntegrityError:
    pass

# Only one active rule per event/tenant.
try:
    conn.execute('''INSERT INTO academy_gamification_rules
      (id,tenant_id,event_type,points,status,version,rationale,configured_by,configured_at,created_at)
      VALUES ('R3','T1','lesson_completed',30,'active',2,'Duplicada','ADMIN',?,?)''', (now,now))
    raise AssertionError('multiple active gamification rules were accepted')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_badges
  (id,tenant_id,code,title,description,criterion_type,criterion_event_type,criterion_value,status,created_by,created_at,updated_at)
  VALUES ('B1','T1','PRIMEIRA_AULA','Primeira aula','Concluiu a primeira aula','event_count','lesson_completed',1,'active','ADMIN',?,?)''', (now,now))
conn.execute('''INSERT INTO academy_user_badges
  (id,tenant_id,user_id,badge_id,awarded_at,evidence_json)
  VALUES ('UB1','T1','U1','B1',?,'{"eventCount":1}')''', (now,))

# User badge cannot cross tenants.
try:
    conn.execute('''INSERT INTO academy_user_badges
      (id,tenant_id,user_id,badge_id,awarded_at,evidence_json)
      VALUES ('BAD2','T2','U2','B1',?,'{}')''', (now,))
    raise AssertionError('cross-tenant badge award was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_gamification_levels
  (id,tenant_id,name,min_xp,position,status,created_by,created_at,updated_at)
  VALUES ('LV1','T1','Inicial',0,0,'active','ADMIN',?,?)''', (now,now))
conn.execute('''INSERT INTO academy_gamification_levels
  (id,tenant_id,name,min_xp,position,status,created_by,created_at,updated_at)
  VALUES ('LV2','T1','Produtor Digital',100,1,'active','ADMIN',?,?)''', (now,now))

xp = conn.execute("SELECT SUM(points) FROM academy_points_ledger WHERE tenant_id='T1' AND user_id='U1'").fetchone()[0]
assert xp == 25
badge = conn.execute("SELECT badge_id FROM academy_user_badges WHERE tenant_id='T1' AND user_id='U1'").fetchone()[0]
assert badge == 'B1'
levels = conn.execute("SELECT name,min_xp FROM academy_gamification_levels WHERE tenant_id='T1' ORDER BY min_xp").fetchall()
assert levels == [('Inicial',0),('Produtor Digital',100)]

conn.close()
print('Gamification integration fixture: PASS')
