from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
migrations = sorted((ROOT / 'migrations').glob('*.sql'))

# Simulate the database immediately before v0.42 so the legacy Smart Farm
# backfill is exercised by the migration itself.
for migration in migrations:
    if migration.name >= '0028_':
        break
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-07T20:00:00.000Z'

for tenant, course in [('T1', 'C1'), ('T2', 'C2')]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?, 'published',0,0,1,'ADMIN','ADMIN',?,?)''',
      (course, tenant, f'Curso {course}', 'Descrição', now, now))

conn.execute('''INSERT INTO academy_enrollments
  (id,tenant_id,course_id,student_id,student_name_snapshot,source,status,enrolled_at,completed_at,updated_at)
  VALUES ('ENR1','T1','C1','U1','Aluno 1','academy','completed',?,?,?)''', (now, now, now))

conn.execute('''INSERT INTO academy_events
  (id,tenant_id,title,description,event_type,modality,status,access_model,starts_at,ends_at,timezone,smart_farm_experience,created_by,created_at,updated_at)
  VALUES ('EV1','T1','Dia de Campo','Experiência legada','field_day','in_person','completed','free',?,?,'America/Sao_Paulo',1,'ADMIN',?,?)''',
  (now, '2026-09-07T22:00:00.000Z', now, now))
conn.execute('''INSERT INTO academy_event_registrations
  (id,tenant_id,event_id,user_id,display_name_snapshot,status,source,marketing_consent,registered_at,updated_at)
  VALUES ('REG1','T1','EV1','U1','Aluno 1','attended','academy',0,?,?)''', (now, now))
conn.execute('''INSERT INTO academy_event_commercial_leads
  (id,tenant_id,event_id,registration_id,user_id,company_id,interest_code,origin,consent_source,consent_recorded_at,stage,created_at,updated_at)
  VALUES ('LEG1','T1','EV1','REG1','U1',NULL,'irrigation','smart_farm_experience','explicit_event_interest',?,'qualified',?,?)''',
  (now, now, now))

# Apply v0.42 migrations including legacy backfill and hardening.
for migration in migrations:
    if migration.name >= '0028_':
        conn.executescript(migration.read_text(encoding='utf-8'))

legacy = conn.execute('''SELECT legacy_event_lead_id,stage,consent_evidence_type,consent_text_snapshot,consent_version
  FROM academy_commercial_opportunities WHERE tenant_id='T1' AND legacy_event_lead_id='LEG1' ''').fetchone()
assert legacy == ('LEG1', 'qualified', 'legacy_event_interest', None, None)

# Configure an explicit recommendation after course completion.
conn.execute('''INSERT INTO academy_commercial_offer_rules (
  id,tenant_id,source_type,source_ref,interest_code,offer_system,offer_ref,offer_label,offer_description,cta_label,
  consent_purpose,consent_text,consent_version,priority,status,created_by,created_at,updated_at
) VALUES (
  'RULE1','T1','course_completion','C1','irrigation','ifarm_services','SERVICE-IRR','Consultoria de irrigação',
  'Diagnóstico técnico relacionado ao curso','Quero saber mais','Permitir contato comercial voluntário',
  'Autorizo a iFarm a registrar meu interesse e entrar em contato sobre esta solução.','v1',10,'active','ADMIN',?,?
)''', (now, now))

# Completion + active rule alone MUST NOT create an opportunity.
count = conn.execute("SELECT COUNT(*) FROM academy_commercial_opportunities WHERE tenant_id='T1' AND user_id='U1' AND source_type='course_completion'").fetchone()[0]
assert count == 0

# Cross-tenant source references are rejected.
try:
    conn.execute('''INSERT INTO academy_commercial_offer_rules (
      id,tenant_id,source_type,source_ref,interest_code,offer_system,offer_ref,offer_label,consent_purpose,consent_text,consent_version,status,created_by,created_at,updated_at
    ) VALUES ('BADRULE','T1','course_completion','C2','iot','ifarm_store','SKU-X','Oferta inválida','Contato','Autorizo contato','v1','draft','ADMIN',?,?)''',
      (now, now))
    raise AssertionError('cross-tenant commercial source was accepted')
except sqlite3.IntegrityError:
    pass

# Explicit opt-in snapshots the offer and consent evidence.
conn.execute('''INSERT INTO academy_commercial_opportunities (
  id,tenant_id,user_id,company_id,source_type,source_ref,source_instance_ref,rule_id,interest_code,offer_system,offer_ref,
  offer_label_snapshot,consent_evidence_type,consent_source,consent_purpose_snapshot,consent_text_snapshot,consent_version,
  consent_recorded_at,stage,created_at,updated_at
) VALUES (
  'OP1','T1','U1',NULL,'course_completion','C1','ENR1','RULE1','irrigation','ifarm_services','SERVICE-IRR',
  'Consultoria de irrigação','explicit_rule_opt_in','academy_offer_rule','Permitir contato comercial voluntário',
  'Autorizo a iFarm a registrar meu interesse e entrar em contato sobre esta solução.','v1',?,'new',?,?
)''', (now, now, now))

try:
    conn.execute('''INSERT INTO academy_commercial_opportunities (
      id,tenant_id,user_id,source_type,source_ref,source_instance_ref,rule_id,interest_code,offer_system,offer_ref,offer_label_snapshot,
      consent_evidence_type,consent_source,consent_purpose_snapshot,consent_text_snapshot,consent_version,consent_recorded_at,stage,created_at,updated_at
    ) VALUES ('OP-DUP','T1','U1','course_completion','C1','ENR1','RULE1','irrigation','ifarm_services','SERVICE-IRR','Consultoria',
      'explicit_rule_opt_in','academy_offer_rule','Contato','Autorizo contato','v1',?,'new',?,?)''', (now, now, now))
    raise AssertionError('duplicate opt-in generated a second opportunity')
except sqlite3.IntegrityError:
    pass

# Active rule content/consent is immutable; new wording requires a new version.
try:
    conn.execute("UPDATE academy_commercial_offer_rules SET consent_text='Texto alterado',updated_at=? WHERE id='RULE1'", (now,))
    raise AssertionError('active consent rule was mutated in place')
except sqlite3.IntegrityError:
    pass

# Consent and offer snapshots on an opportunity are immutable.
try:
    conn.execute("UPDATE academy_commercial_opportunities SET consent_version='v2',updated_at=? WHERE id='OP1'", (now,))
    raise AssertionError('consent evidence snapshot was mutated')
except sqlite3.IntegrityError:
    pass
try:
    conn.execute("UPDATE academy_commercial_opportunities SET offer_ref='SERVICE-OTHER',updated_at=? WHERE id='OP1'", (now,))
    raise AssertionError('offer snapshot was mutated')
except sqlite3.IntegrityError:
    pass

# A conversion needs a real external/internal conversion reference.
try:
    conn.execute("UPDATE academy_commercial_opportunities SET stage='converted',converted_at=?,updated_at=? WHERE id='OP1'", (now, now))
    raise AssertionError('conversion without reference was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute("UPDATE academy_commercial_opportunities SET stage='converted',conversion_ref='ORDER-123',converted_at=?,updated_at=? WHERE id='OP1'", (now, now))
converted = conn.execute("SELECT stage,conversion_ref FROM academy_commercial_opportunities WHERE id='OP1'").fetchone()
assert converted == ('converted', 'ORDER-123')
try:
    conn.execute("UPDATE academy_commercial_opportunities SET stage='contacted',updated_at=? WHERE id='OP1'", (now,))
    raise AssertionError('converted opportunity moved backwards')
except sqlite3.IntegrityError:
    pass

# Tenant-scoped projection cannot leak T1 opportunities into T2.
assert conn.execute("SELECT COUNT(*) FROM academy_commercial_opportunities WHERE tenant_id='T2'").fetchone()[0] == 0

conn.close()
print('Commercial engine integration fixture: PASS')
