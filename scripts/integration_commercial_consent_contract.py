from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-07T21:00:00.000Z'

for tenant, course in [('T1','C1'),('T2','C2')]:
    conn.execute('''INSERT INTO academy_courses
      (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?, 'published',0,0,1,'ADMIN','ADMIN',?,?)''',(course,tenant,f'Curso {course}','Descrição',now,now))

for rule_id, offer_ref in [('R1','SERVICE-1'),('R2','SERVICE-2')]:
    conn.execute('''INSERT INTO academy_commercial_offer_rules (
      id,tenant_id,source_type,source_ref,interest_code,offer_system,offer_ref,offer_label,offer_description,cta_label,
      consent_purpose,consent_text,consent_version,priority,status,created_by,created_at,updated_at
    ) VALUES (?, 'T1','course_completion','C1','irrigation','ifarm_services',?,'Consultoria','Diagnóstico','Quero saber mais',
      'Permitir contato voluntário','Autorizo contato comercial relacionado.','v1',10,'active','ADMIN',?,?)''',(rule_id,offer_ref,now,now))

conn.execute('''INSERT INTO academy_commercial_opportunities (
  id,tenant_id,user_id,source_type,source_ref,rule_id,interest_code,offer_system,offer_ref,offer_label_snapshot,
  consent_evidence_type,consent_source,consent_purpose_snapshot,consent_text_snapshot,consent_version,consent_recorded_at,
  stage,created_at,updated_at
) VALUES ('OP1','T1','U1','course_completion','C1','R1','irrigation','ifarm_services','SERVICE-1','Consultoria',
  'explicit_rule_opt_in','academy_offer_rule','Permitir contato voluntário','Autorizo contato comercial relacionado.','v1',?,
  'qualified',?,?)''',(now,now,now))

conn.execute('''INSERT INTO academy_commercial_handoff_outbox
  (id,tenant_id,opportunity_id,destination_system,event_type,payload_version,payload_json,status,attempts,requested_by,created_at,updated_at)
  VALUES ('H1','T1','OP1','ifarm_core','commercial.opportunity.ready',1,'{}','pending',0,'ADMIN',?,?)''',(now,now))

# Global suppression is append-only and immediately blocks new commercial work.
conn.execute('''INSERT INTO academy_commercial_contact_preference_events
  (id,tenant_id,user_id,action,source,reason,recorded_by,created_at)
  VALUES ('SUP1','T1','U1','suppress_all','self_service','bloqueio','U1',?)''',(now,))

try:
    conn.execute('''INSERT INTO academy_commercial_opportunities (
      id,tenant_id,user_id,source_type,source_ref,rule_id,interest_code,offer_system,offer_ref,offer_label_snapshot,
      consent_evidence_type,consent_source,consent_purpose_snapshot,consent_text_snapshot,consent_version,consent_recorded_at,
      stage,created_at,updated_at
    ) VALUES ('OP2','T1','U1','course_completion','C1','R2','irrigation','ifarm_services','SERVICE-2','Consultoria 2',
      'explicit_rule_opt_in','academy_offer_rule','Contato','Autorizo','v1',?,'new',?,?)''',(now,now,now))
    raise AssertionError('suppressed user created a new commercial opportunity')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute('''INSERT INTO academy_commercial_handoff_outbox
      (id,tenant_id,opportunity_id,destination_system,event_type,payload_version,payload_json,status,attempts,requested_by,created_at,updated_at)
      VALUES ('H2','T1','OP1','crm','commercial.opportunity.ready',1,'{}','pending',0,'ADMIN',?,?)''',(now,now))
    raise AssertionError('suppressed user received a new handoff')
except sqlite3.IntegrityError:
    pass

try:
    conn.execute("UPDATE academy_commercial_handoff_outbox SET status='processing',attempts=1,updated_at=? WHERE id='H1'",(now,))
    raise AssertionError('suppressed handoff entered processing')
except sqlite3.IntegrityError:
    pass

# Self-service/API semantics cancel not-yet-delivered handoffs after suppression.
conn.execute("UPDATE academy_commercial_handoff_outbox SET status='cancelled',updated_at=? WHERE id='H1'",(now,))

# Same timestamp: monotonic seq, not UUID ordering, defines the current state.
conn.execute('''INSERT INTO academy_commercial_contact_preference_events
  (id,tenant_id,user_id,action,source,reason,recorded_by,created_at)
  VALUES ('AAA-RESUME','T1','U1','resume','self_service','retomada','U1',?)''',(now,))
latest = conn.execute("SELECT action FROM academy_commercial_contact_preference_events WHERE tenant_id='T1' AND user_id='U1' ORDER BY seq DESC LIMIT 1").fetchone()
assert latest == ('resume',)

# Existing original consent is usable again after global resume unless individually revoked.
conn.execute('''INSERT INTO academy_commercial_handoff_outbox
  (id,tenant_id,opportunity_id,destination_system,event_type,payload_version,payload_json,status,attempts,requested_by,created_at,updated_at)
  VALUES ('H3','T1','OP1','ifarm_core','commercial.opportunity.ready',1,'{}','pending',0,'ADMIN',?,?)''',(now,now))

conn.execute('''INSERT INTO academy_commercial_opportunity_consent_events
  (id,tenant_id,opportunity_id,user_id,action,source,reason,recorded_by,created_at)
  VALUES ('REV1','T1','OP1','U1','revoked','self_service','não quero contato','U1',?)''',(now,))

try:
    conn.execute("UPDATE academy_commercial_handoff_outbox SET status='processing',attempts=1,updated_at=? WHERE id='H3'",(now,))
    raise AssertionError('revoked opportunity handoff entered processing')
except sqlite3.IntegrityError:
    pass
conn.execute("UPDATE academy_commercial_handoff_outbox SET status='cancelled',updated_at=? WHERE id='H3'",(now,))

try:
    conn.execute('''INSERT INTO academy_commercial_opportunity_consent_events
      (id,tenant_id,opportunity_id,user_id,action,source,consent_version,recorded_by,created_at)
      VALUES ('BADVER','T1','OP1','U1','regranted','self_service','v999','U1',?)''',(now,))
    raise AssertionError('regrant accepted an invalid consent version')
except sqlite3.IntegrityError:
    pass

conn.execute('''INSERT INTO academy_commercial_opportunity_consent_events
  (id,tenant_id,opportunity_id,user_id,action,source,consent_version,reason,recorded_by,created_at)
  VALUES ('REG1','T1','OP1','U1','regranted','self_service','v1','reautorizado','U1',?)''',(now,))
latest_op = conn.execute("SELECT action FROM academy_commercial_opportunity_consent_events WHERE opportunity_id='OP1' ORDER BY seq DESC LIMIT 1").fetchone()
assert latest_op == ('regranted',)

conn.execute('''INSERT INTO academy_commercial_handoff_outbox
  (id,tenant_id,opportunity_id,destination_system,event_type,payload_version,payload_json,status,attempts,requested_by,created_at,updated_at)
  VALUES ('H4','T1','OP1','ifarm_core','commercial.opportunity.ready',1,'{}','pending',0,'ADMIN',?,?)''',(now,now))

# Consent event history cannot be rewritten.
try:
    conn.execute("UPDATE academy_commercial_opportunity_consent_events SET reason='alterado' WHERE id='REG1'")
    raise AssertionError('consent history was mutable')
except sqlite3.IntegrityError:
    pass

# Cross-tenant/user mismatch is rejected.
try:
    conn.execute('''INSERT INTO academy_commercial_opportunity_consent_events
      (id,tenant_id,opportunity_id,user_id,action,source,reason,recorded_by,created_at)
      VALUES ('XT','T2','OP1','U1','revoked','admin_privacy_request','pedido','ADMIN',?)''',(now,))
    raise AssertionError('cross-tenant privacy event was accepted')
except sqlite3.IntegrityError:
    pass

# Global suppression also blocks regrant even when the individual version is valid.
conn.execute("UPDATE academy_commercial_handoff_outbox SET status='cancelled',updated_at=? WHERE id='H4'",(now,))
conn.execute('''INSERT INTO academy_commercial_opportunity_consent_events
  (id,tenant_id,opportunity_id,user_id,action,source,reason,recorded_by,created_at)
  VALUES ('REV2','T1','OP1','U1','revoked','self_service','nova revogação','U1',?)''',(now,))
conn.execute('''INSERT INTO academy_commercial_contact_preference_events
  (id,tenant_id,user_id,action,source,reason,recorded_by,created_at)
  VALUES ('SUP2','T1','U1','suppress_all','self_service','bloqueio global','U1',?)''',(now,))
try:
    conn.execute('''INSERT INTO academy_commercial_opportunity_consent_events
      (id,tenant_id,opportunity_id,user_id,action,source,consent_version,recorded_by,created_at)
      VALUES ('BLOCKED-REG','T1','OP1','U1','regranted','self_service','v1','U1',?)''',(now,))
    raise AssertionError('regrant bypassed global suppression')
except sqlite3.IntegrityError:
    pass

conn.close()
print('Commercial consent governance integration fixture: PASS')
