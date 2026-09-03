from pathlib import Path
import hashlib
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

T1, T2 = 'TENANT-SMART', 'TENANT-OTHER'
EVENT = 'EVENT-SMART-1'
REG = 'REG-SMART-1'
AGENDA = 'AGENDA-1'

conn.execute('''
INSERT INTO academy_events (
 id,tenant_id,title,description,event_type,modality,status,access_model,currency,
 starts_at,ends_at,timezone,smart_farm_experience,created_by,created_at,updated_at
) VALUES (?,?,?,?,?,'in_person','published','free','BRL',?,?,'America/Sao_Paulo',1,?,?,?)
''', (EVENT,T1,'Smart Farm Experience','Dia de campo','field_day','2026-09-10T12:00:00.000Z','2026-09-10T18:00:00.000Z','ADMIN','2026-09-01T10:00:00.000Z','2026-09-01T10:00:00.000Z'))
conn.execute('''
INSERT INTO academy_event_registrations (
 id,tenant_id,event_id,user_id,display_name_snapshot,status,source,marketing_consent,registered_at,updated_at
) VALUES (?,?,?,?,?,'attended','academy',0,?,?)
''', (REG,T1,EVENT,'USER-1','Participante Teste','2026-09-02T10:00:00.000Z','2026-09-10T12:05:00.000Z'))
conn.execute('''
INSERT INTO academy_smart_farm_agenda_items (
 id,tenant_id,event_id,title,description,activity_type,position,location_label,
 requires_practical_evidence,interest_code,created_by,created_at,updated_at
) VALUES (?,?,?,?,?,'demonstration',0,'Pivô central',1,'irrigation','ADMIN',?,?)
''', (AGENDA,T1,EVENT,'Irrigação 4.0','Demonstração prática','2026-09-01T10:00:00.000Z','2026-09-01T10:00:00.000Z'))

# Raw QR token never enters the database; only SHA-256 does.
raw_token = 'RAW-TOKEN-SHOULD-NOT-BE-STORED'
token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
conn.execute('''
INSERT INTO academy_event_qr_tokens (
 id,tenant_id,event_id,purpose,agenda_item_id,token_hash,valid_from,valid_until,
 active,use_count,created_by,created_at
) VALUES ('TOKEN-1',?,?, 'station', ?, ?, ?, ?,1,0,'ADMIN',?)
''', (T1,EVENT,AGENDA,token_hash,'2026-09-10T11:00:00.000Z','2026-09-10T19:00:00.000Z','2026-09-01T10:00:00.000Z'))
stored = conn.execute("SELECT token_hash FROM academy_event_qr_tokens WHERE id='TOKEN-1'").fetchone()[0]
assert stored == token_hash
assert raw_token not in stored
assert len(stored) == 64

# Station tokens must reference an agenda item.
try:
    conn.execute('''
    INSERT INTO academy_event_qr_tokens (
     id,tenant_id,event_id,purpose,token_hash,valid_from,valid_until,active,use_count,created_by,created_at
    ) VALUES ('TOKEN-BAD',?,?,'station','HASH-BAD',?,?,1,0,'ADMIN',?)
    ''', (T1,EVENT,'2026-09-10T11:00:00.000Z','2026-09-10T19:00:00.000Z','2026-09-01T10:00:00.000Z'))
    raise AssertionError('station token without agenda should fail')
except sqlite3.IntegrityError:
    pass

# Cross-tenant agenda relation is rejected.
try:
    conn.execute('''
    INSERT INTO academy_smart_farm_agenda_items (
     id,tenant_id,event_id,title,activity_type,position,requires_practical_evidence,created_by,created_at,updated_at
    ) VALUES ('AGENDA-X',?,?,'Invalid','visit',0,0,'ADMIN',?,?)
    ''', (T2,EVENT,'2026-09-01T10:00:00.000Z','2026-09-01T10:00:00.000Z'))
    raise AssertionError('cross-tenant agenda should fail')
except sqlite3.IntegrityError:
    pass

# Practical evidence is linked to the exact registration + event + agenda.
conn.execute('''
INSERT INTO academy_event_practical_evidence (
 id,tenant_id,event_id,registration_id,agenda_item_id,evidence_type,evidence_json,status,
 submitted_by,validated_by,validated_at,created_at,updated_at
) VALUES ('PE-1',?,?,?,?, 'qr','{"station":"pivot"}','validated','USER-1','system:qr_token',?,?,?)
''', (T1,EVENT,REG,AGENDA,'2026-09-10T13:00:00.000Z','2026-09-10T13:00:00.000Z','2026-09-10T13:00:00.000Z'))
assert conn.execute("SELECT status FROM academy_event_practical_evidence WHERE id='PE-1'").fetchone()[0] == 'validated'

try:
    conn.execute('''
    INSERT INTO academy_event_practical_evidence (
     id,tenant_id,event_id,registration_id,agenda_item_id,evidence_type,status,submitted_by,created_at,updated_at
    ) VALUES ('PE-X',?,?,?,?, 'manual','pending','ADMIN',?,?)
    ''', (T2,EVENT,REG,AGENDA,'2026-09-10T13:00:00.000Z','2026-09-10T13:00:00.000Z'))
    raise AssertionError('cross-tenant practical evidence should fail')
except sqlite3.IntegrityError:
    pass

# Commercial lead requires an explicit consent source and is unique by interest.
conn.execute('''
INSERT INTO academy_event_commercial_leads (
 id,tenant_id,event_id,registration_id,user_id,interest_code,origin,consent_source,
 consent_recorded_at,stage,created_at,updated_at
) VALUES ('LEAD-1',?,?,?,?,?,'smart_farm_experience','explicit_event_interest',?,'new',?,?)
''', (T1,EVENT,REG,'USER-1','irrigation','2026-09-10T14:00:00.000Z','2026-09-10T14:00:00.000Z','2026-09-10T14:00:00.000Z'))
conn.execute("UPDATE academy_event_commercial_leads SET stage='qualified' WHERE id='LEAD-1'")
assert conn.execute("SELECT stage FROM academy_event_commercial_leads WHERE id='LEAD-1'").fetchone()[0] == 'qualified'

try:
    conn.execute('''
    INSERT INTO academy_event_commercial_leads (
     id,tenant_id,event_id,registration_id,user_id,interest_code,consent_source,
     consent_recorded_at,stage,created_at,updated_at
    ) VALUES ('LEAD-DUP',?,?,?,?,?,'explicit_event_interest',?,'new',?,?)
    ''', (T1,EVENT,REG,'USER-1','irrigation','2026-09-10T14:01:00.000Z','2026-09-10T14:01:00.000Z','2026-09-10T14:01:00.000Z'))
    raise AssertionError('duplicate event interest should fail')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''
    INSERT INTO academy_event_commercial_leads (
     id,tenant_id,event_id,registration_id,user_id,interest_code,consent_source,
     consent_recorded_at,stage,created_at,updated_at
    ) VALUES ('LEAD-X',?,?,?,?,?,'explicit_event_interest',?,'new',?,?)
    ''', (T2,EVENT,REG,'USER-1','credit','2026-09-10T14:02:00.000Z','2026-09-10T14:02:00.000Z','2026-09-10T14:02:00.000Z'))
    raise AssertionError('cross-tenant lead should fail')
except sqlite3.IntegrityError:
    pass

print('smart farm field experience contract: PASS')
