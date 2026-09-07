from pathlib import Path
import sqlite3

ROOT=Path(__file__).resolve().parents[1]
conn=sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT/'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now='2026-09-07T22:00:00.000Z'
future='2026-09-07T22:05:00.000Z'
past='2026-09-07T21:59:00.000Z'

conn.execute('''INSERT INTO academy_courses
  (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
  VALUES ('C1','T1','Curso','Descrição','published',0,0,1,'ADMIN','ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_commercial_offer_rules (
  id,tenant_id,source_type,source_ref,interest_code,offer_system,offer_ref,offer_label,offer_description,cta_label,
  consent_purpose,consent_text,consent_version,priority,status,created_by,created_at,updated_at
) VALUES ('R1','T1','course_completion','C1','irrigation','ifarm_services','SVC-1','Consultoria','','Quero saber mais',
  'Contato comercial','Autorizo contato','v1',10,'active','ADMIN',?,?)''',(now,now))
conn.execute('''INSERT INTO academy_commercial_opportunities (
  id,tenant_id,user_id,source_type,source_ref,rule_id,interest_code,offer_system,offer_ref,offer_label_snapshot,
  consent_evidence_type,consent_source,consent_purpose_snapshot,consent_text_snapshot,consent_version,consent_recorded_at,
  stage,created_at,updated_at
) VALUES ('OP1','T1','U1','course_completion','C1','R1','irrigation','ifarm_services','SVC-1','Consultoria',
  'explicit_rule_opt_in','academy_offer_rule','Contato comercial','Autorizo contato','v1',?,'qualified',?,?)''',(now,now,now))

# A oportunidade pode ter um handoff aberto por destino. Os três cenários usam
# destinos distintos para respeitar a unicidade da outbox.
for hid,destination in (('H1','ifarm_core'),('H2','crm'),('H3','partner')):
    conn.execute('''INSERT INTO academy_commercial_handoff_outbox
      (id,tenant_id,opportunity_id,destination_system,event_type,payload_version,payload_json,status,attempts,requested_by,created_at,updated_at)
      VALUES (?, 'T1','OP1',?,'commercial.opportunity.ready',1,'{"schema":"commercial.opportunity.ready.v1"}','pending',0,'ADMIN',?,?)''',(hid,destination,now,now))

# Claim 1 succeeds and is exclusive.
conn.execute('''INSERT INTO academy_commercial_handoff_claims
  (id,tenant_id,handoff_id,claim_token,worker_id,claimed_at,expires_at)
  VALUES ('CL1','T1','H1','TOKEN1','W1',?,?)''',(now,future))
try:
    conn.execute('''INSERT INTO academy_commercial_handoff_claims
      (id,tenant_id,handoff_id,claim_token,worker_id,claimed_at,expires_at)
      VALUES ('CL1B','T1','H1','TOKEN1B','W2',?,?)''',(now,future))
    raise AssertionError('second open claim was accepted')
except sqlite3.IntegrityError:
    pass

conn.execute("UPDATE academy_commercial_handoff_outbox SET status='processing',attempts=1,updated_at=? WHERE id='H1'",(now,))
conn.execute('''INSERT INTO academy_commercial_handoff_attempts
  (id,tenant_id,handoff_id,claim_id,worker_id,attempt_number,status,started_at)
  VALUES ('A1','T1','H1','CL1','W1',1,'processing',?)''',(now,))

# Retryable failure closes the claim and schedules the handoff.
conn.execute("UPDATE academy_commercial_handoff_outbox SET status='failed',last_error_code='remote_503',next_attempt_at=?,updated_at=? WHERE id='H1'",(future,now))
conn.execute("UPDATE academy_commercial_handoff_attempts SET status='failed',completed_at=?,error_code='remote_503' WHERE id='A1'",(now,))
conn.execute("UPDATE academy_commercial_handoff_claims SET released_at=?,release_reason='failed' WHERE id='CL1'",(now,))

# Failed handoff cannot be claimed before next_attempt_at.
try:
    conn.execute('''INSERT INTO academy_commercial_handoff_claims
      (id,tenant_id,handoff_id,claim_token,worker_id,claimed_at,expires_at)
      VALUES ('EARLY','T1','H1','EARLY-T','W1',?,?)''',(now,future))
    raise AssertionError('failed handoff was claimed before retry time')
except sqlite3.IntegrityError:
    pass

# Once due, a new claim and attempt are allowed.
conn.execute("UPDATE academy_commercial_handoff_outbox SET next_attempt_at=?,updated_at=? WHERE id='H1'",(past,now))
conn.execute('''INSERT INTO academy_commercial_handoff_claims
  (id,tenant_id,handoff_id,claim_token,worker_id,claimed_at,expires_at)
  VALUES ('CL2','T1','H1','TOKEN2','W1',?,?)''',(now,future))
conn.execute("UPDATE academy_commercial_handoff_outbox SET status='processing',attempts=2,next_attempt_at=NULL,updated_at=? WHERE id='H1'",(now,))
conn.execute('''INSERT INTO academy_commercial_handoff_attempts
  (id,tenant_id,handoff_id,claim_id,worker_id,attempt_number,status,started_at)
  VALUES ('A2','T1','H1','CL2','W1',2,'processing',?)''',(now,))

# Terminal failure can enter dead-letter and cannot be reclaimed.
conn.execute("UPDATE academy_commercial_handoff_outbox SET status='failed',last_error_code='terminal',next_attempt_at=NULL,updated_at=? WHERE id='H1'",(now,))
conn.execute("UPDATE academy_commercial_handoff_attempts SET status='failed',completed_at=?,error_code='terminal' WHERE id='A2'",(now,))
conn.execute("UPDATE academy_commercial_handoff_claims SET released_at=?,release_reason='failed' WHERE id='CL2'",(now,))
conn.execute('''INSERT INTO academy_commercial_handoff_dead_letters
  (id,tenant_id,handoff_id,attempts,reason_code,created_at)
  VALUES ('DL1','T1','H1',2,'terminal',?)''',(now,))
try:
    conn.execute('''INSERT INTO academy_commercial_handoff_claims
      (id,tenant_id,handoff_id,claim_token,worker_id,claimed_at,expires_at)
      VALUES ('NOPE','T1','H1','NOPE-T','W1',?,?)''',(now,future))
    raise AssertionError('dead-lettered handoff was reclaimed')
except sqlite3.IntegrityError:
    pass
try:
    conn.execute("UPDATE academy_commercial_handoff_dead_letters SET reason_code='changed' WHERE id='DL1'")
    raise AssertionError('dead letter was mutable')
except sqlite3.IntegrityError:
    pass

# Successful delivery requires a receipt on the attempt and handoff.
conn.execute('''INSERT INTO academy_commercial_handoff_claims
  (id,tenant_id,handoff_id,claim_token,worker_id,claimed_at,expires_at)
  VALUES ('CL3','T1','H2','TOKEN3','W1',?,?)''',(now,future))
conn.execute("UPDATE academy_commercial_handoff_outbox SET status='processing',attempts=1,updated_at=? WHERE id='H2'",(now,))
conn.execute('''INSERT INTO academy_commercial_handoff_attempts
  (id,tenant_id,handoff_id,claim_id,worker_id,attempt_number,status,started_at)
  VALUES ('A3','T1','H2','CL3','W1',1,'processing',?)''',(now,))
try:
    conn.execute("UPDATE academy_commercial_handoff_attempts SET status='delivered',completed_at=? WHERE id='A3'",(now,))
    raise AssertionError('attempt delivered without receipt')
except sqlite3.IntegrityError:
    pass
conn.execute("UPDATE academy_commercial_handoff_outbox SET status='delivered',delivery_reference='CRM-123',delivered_at=?,updated_at=? WHERE id='H2'",(now,now))
conn.execute("UPDATE academy_commercial_handoff_attempts SET status='delivered',completed_at=?,delivery_reference='CRM-123' WHERE id='A3'",(now,))
conn.execute("UPDATE academy_commercial_handoff_claims SET released_at=?,release_reason='delivered' WHERE id='CL3'",(now,))

# Privacy state blocks the claim itself.
conn.execute('''INSERT INTO academy_commercial_contact_preference_events
  (id,tenant_id,user_id,action,source,reason,recorded_by,created_at)
  VALUES ('SUP-W','T1','U1','suppress_all','self_service','privacy','U1',?)''',(now,))
try:
    conn.execute('''INSERT INTO academy_commercial_handoff_claims
      (id,tenant_id,handoff_id,claim_token,worker_id,claimed_at,expires_at)
      VALUES ('PRIV','T1','H3','PRIV-T','W1',?,?)''',(now,future))
    raise AssertionError('worker claim bypassed privacy suppression')
except sqlite3.IntegrityError:
    pass

conn.close()
print('Commercial delivery worker integration fixture: PASS')
