from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-07T21:00:00.000Z'

conn.execute('''INSERT INTO academy_courses
  (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
  VALUES ('C1','T1','Curso irrigação','Descrição','published',0,0,1,'ADMIN','ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_enrollments
  (id,tenant_id,course_id,student_id,student_name_snapshot,source,status,enrolled_at,completed_at,updated_at)
  VALUES ('ENR1','T1','C1','U1','Aluno 1','academy','completed',?,?,?)''',(now,now,now))
conn.execute('''INSERT INTO academy_commercial_offer_rules (
  id,tenant_id,source_type,source_ref,interest_code,offer_system,offer_ref,offer_label,offer_description,cta_label,
  consent_purpose,consent_text,consent_version,priority,status,created_by,created_at,updated_at
) VALUES ('R1','T1','course_completion','C1','irrigation','ifarm_services','SERVICE-1','Consultoria de irrigação','Diagnóstico','Quero saber mais',
  'Permitir contato comercial','Autorizo contato da iFarm sobre esta solução.','v1',10,'active','ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_commercial_opportunities (
  id,tenant_id,user_id,source_type,source_ref,source_instance_ref,rule_id,interest_code,offer_system,offer_ref,offer_label_snapshot,
  consent_evidence_type,consent_source,consent_purpose_snapshot,consent_text_snapshot,consent_version,consent_recorded_at,stage,created_at,updated_at
) VALUES ('OP1','T1','U1','course_completion','C1','ENR1','R1','irrigation','ifarm_services','SERVICE-1','Consultoria de irrigação',
  'explicit_rule_opt_in','academy_offer_rule','Permitir contato comercial','Autorizo contato da iFarm sobre esta solução.','v1',?,'new',?,?)''',(now,now,now))

# New interest is not ready for integration until qualified.
try:
    conn.execute('''INSERT INTO academy_commercial_handoff_outbox
      (id,tenant_id,opportunity_id,destination_system,event_type,payload_version,payload_json,status,attempts,requested_by,created_at,updated_at)
      VALUES ('H-BAD','T1','OP1','ifarm_core','commercial.opportunity.ready',1,'{}','pending',0,'ADMIN',?,?)''',(now,now))
    raise AssertionError('handoff accepted an unqualified opportunity')
except sqlite3.IntegrityError:
    pass

conn.execute("UPDATE academy_commercial_opportunities SET stage='qualified',updated_at=? WHERE id='OP1'",(now,))
conn.execute('''INSERT INTO academy_commercial_handoff_outbox
  (id,tenant_id,opportunity_id,destination_system,event_type,payload_version,payload_json,status,attempts,requested_by,created_at,updated_at)
  VALUES ('H1','T1','OP1','ifarm_core','commercial.opportunity.ready',1,
  '{"opportunityId":"OP1","sourceType":"course_completion","sourceRef":"C1"}','pending',0,'ADMIN',?,?)''',(now,now))

# Open handoff is idempotent by destination/event.
try:
    conn.execute('''INSERT INTO academy_commercial_handoff_outbox
      (id,tenant_id,opportunity_id,destination_system,event_type,payload_version,payload_json,status,attempts,requested_by,created_at,updated_at)
      VALUES ('H-DUP','T1','OP1','ifarm_core','commercial.opportunity.ready',1,'{}','pending',0,'ADMIN',?,?)''',(now,now))
    raise AssertionError('duplicate open handoff was accepted')
except sqlite3.IntegrityError:
    pass

# Payload is immutable after the outbox event is created.
try:
    conn.execute("UPDATE academy_commercial_handoff_outbox SET payload_json='{}',updated_at=? WHERE id='H1'",(now,))
    raise AssertionError('handoff payload was mutated')
except sqlite3.IntegrityError:
    pass

# Delivery cannot be fabricated without a destination reference.
try:
    conn.execute("UPDATE academy_commercial_handoff_outbox SET status='delivered',delivered_at=?,updated_at=? WHERE id='H1'",(now,now))
    raise AssertionError('handoff delivered without reference')
except sqlite3.IntegrityError:
    pass

conn.execute("UPDATE academy_commercial_handoff_outbox SET status='processing',attempts=1,updated_at=? WHERE id='H1'",(now,))
try:
    conn.execute("UPDATE academy_commercial_handoff_outbox SET status='failed',last_error_code=NULL,updated_at=? WHERE id='H1'",(now,))
    raise AssertionError('failed handoff accepted without error code')
except sqlite3.IntegrityError:
    pass
conn.execute("UPDATE academy_commercial_handoff_outbox SET status='failed',last_error_code='E_TIMEOUT',updated_at=? WHERE id='H1'",(now,))
conn.execute("UPDATE academy_commercial_handoff_outbox SET status='pending',last_error_code=NULL,updated_at=? WHERE id='H1'",(now,))
conn.execute("UPDATE academy_commercial_handoff_outbox SET status='delivered',delivery_reference='CORE-LEAD-77',delivered_at=?,updated_at=? WHERE id='H1'",(now,now))
try:
    conn.execute("UPDATE academy_commercial_handoff_outbox SET status='pending',updated_at=? WHERE id='H1'",(now,))
    raise AssertionError('delivered handoff was reopened')
except sqlite3.IntegrityError:
    pass

# Evidence cannot exist before the opportunity is actually marked converted.
try:
    conn.execute('''INSERT INTO academy_commercial_conversion_evidence
      (id,tenant_id,opportunity_id,evidence_system,evidence_ref,attributed_value_cents,currency,confirmed_at,recorded_by,created_at)
      VALUES ('E-BAD','T1','OP1','order','ORDER-1',100000,'BRL',?,'ADMIN',?)''',(now,now))
    raise AssertionError('conversion evidence accepted before conversion')
except sqlite3.IntegrityError:
    pass

conn.execute("UPDATE academy_commercial_opportunities SET stage='converted',conversion_ref='ORDER-1',converted_at=?,updated_at=? WHERE id='OP1'",(now,now))
conn.execute('''INSERT INTO academy_commercial_conversion_evidence
  (id,tenant_id,opportunity_id,evidence_system,evidence_ref,attributed_value_cents,currency,confirmed_at,recorded_by,created_at)
  VALUES ('E1','T1','OP1','order','ORDER-1',100000,'BRL',?,'ADMIN',?)''',(now,now))
conn.execute('''INSERT INTO academy_commercial_conversion_evidence
  (id,tenant_id,opportunity_id,evidence_system,evidence_ref,attributed_value_cents,currency,confirmed_at,recorded_by,created_at)
  VALUES ('E2','T1','OP1','contract','CONTRACT-USD-1',25000,'USD',?,'ADMIN',?)''',(now,now))

# Evidence is append-only and immutable.
try:
    conn.execute("UPDATE academy_commercial_conversion_evidence SET attributed_value_cents=200000 WHERE id='E1'")
    raise AssertionError('conversion evidence was mutated')
except sqlite3.IntegrityError:
    pass

# Currency totals remain segregated instead of being added together.
totals = conn.execute('''SELECT currency,SUM(attributed_value_cents) FROM academy_commercial_conversion_evidence
  WHERE tenant_id='T1' GROUP BY currency ORDER BY currency''').fetchall()
assert totals == [('BRL',100000),('USD',25000)]

# Tenant mismatch is rejected at the database boundary.
try:
    conn.execute('''INSERT INTO academy_commercial_handoff_outbox
      (id,tenant_id,opportunity_id,destination_system,event_type,payload_version,payload_json,status,attempts,requested_by,created_at,updated_at)
      VALUES ('H-X','T2','OP1','crm','commercial.opportunity.ready',1,'{}','pending',0,'ADMIN',?,?)''',(now,now))
    raise AssertionError('cross-tenant handoff was accepted')
except sqlite3.IntegrityError:
    pass

conn.close()
print('Commercial handoff and metrics integration fixture: PASS')
