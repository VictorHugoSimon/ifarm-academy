from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
for migration in sorted((ROOT / 'migrations').glob('*.sql')):
    conn.executescript(migration.read_text(encoding='utf-8'))

now = '2026-09-09T19:00:00.000Z'
expires = '2026-09-09T19:05:00.000Z'

# Cursos em tenants distintos para provar isolamento.
conn.execute('''INSERT INTO academy_courses
  (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
  VALUES ('C1','T1','Irrigação','Curso','published',0,0,1,'A1','A1',?,?)''', (now, now))
conn.execute('''INSERT INTO academy_courses
  (id,tenant_id,title,description,status,quiz_enabled,minimum_score,attempts_allowed,created_by,updated_by,created_at,updated_at)
  VALUES ('C2','T2','Outro tenant','Curso','published',0,0,1,'A2','A2',?,?)''', (now, now))
conn.execute('''INSERT INTO academy_enrollments
  (id,tenant_id,course_id,student_id,student_name_snapshot,source,status,enrolled_at,completed_at,updated_at)
  VALUES ('EN1','T1','C1','U1','Aluno','academy','active',?,NULL,?)''', (now, now))
conn.execute('''INSERT INTO academy_tutor_course_policies
  (tenant_id,course_id,enabled,approved_by,approved_at,last_indexed_at,last_indexed_course_updated_at,created_at,updated_at,
   generative_enabled,generative_approved_by,generative_approved_at,generative_approved_course_updated_at,generative_disabled_at)
  VALUES ('T1','C1',1,'ADMIN1',?,NULL,NULL,?, ?,1,'ADMIN1',?,?,NULL)''', (now, now, now, now, now))
conn.execute('''INSERT INTO academy_tutor_sessions
  (id,tenant_id,student_id,course_id,title,status,created_at,updated_at)
  VALUES ('S1','T1','U1','C1','Sessão','active',?,?)''', (now, now))

# Sem política de tenant nenhuma reserva pode ser criada.
try:
    conn.execute('''INSERT INTO academy_tutor_usage_reservations
      (id,tenant_id,student_id,course_id,request_chars,status,created_at,expires_at,finalized_at)
      VALUES ('R0','T1','U1','C1',600,'reserved',?,?,NULL)''', (now, expires))
    raise AssertionError('Reservation accepted without tenant usage policy')
except sqlite3.IntegrityError:
    pass

# Política explícita de teste: 1 chamada/dia e 1000 chars/dia.
conn.execute('''INSERT INTO academy_tutor_usage_policies
  (id,tenant_id,scope_type,scope_id,period,version,max_provider_requests,max_request_chars,status,
   rationale,approved_by,approved_at,archived_at,created_at)
  VALUES ('QP1','T1','tenant',NULL,'day',1,1,1000,'active',
          'Limite explícito para contrato de integração.','ADMIN1',?,NULL,?)''', (now, now))

# Uma segunda política ativa para o mesmo escopo/período é proibida.
try:
    conn.execute('''INSERT INTO academy_tutor_usage_policies
      (id,tenant_id,scope_type,scope_id,period,version,max_provider_requests,max_request_chars,status,
       rationale,approved_by,approved_at,archived_at,created_at)
      VALUES ('QP_DUP','T1','tenant',NULL,'day',2,5,5000,'active',
              'Duplicata ativa não pode coexistir.','ADMIN1',?,NULL,?)''', (now, now))
    raise AssertionError('Duplicate active tenant policy accepted')
except sqlite3.IntegrityError:
    pass

# Curso de outro tenant não pode virar escopo da política T1.
try:
    conn.execute('''INSERT INTO academy_tutor_usage_policies
      (id,tenant_id,scope_type,scope_id,period,version,max_provider_requests,max_request_chars,status,
       rationale,approved_by,approved_at,archived_at,created_at)
      VALUES ('QP_BAD_COURSE','T1','course','C2','day',1,2,2000,'active',
              'Política cross tenant inválida.','ADMIN1',?,NULL,?)''', (now, now))
    raise AssertionError('Cross-tenant course policy accepted')
except sqlite3.IntegrityError:
    pass

# Aluno inexistente no tenant também é recusado.
try:
    conn.execute('''INSERT INTO academy_tutor_usage_policies
      (id,tenant_id,scope_type,scope_id,period,version,max_provider_requests,max_request_chars,status,
       rationale,approved_by,approved_at,archived_at,created_at)
      VALUES ('QP_BAD_STUDENT','T1','student','U404','day',1,2,2000,'active',
              'Aluno inexistente não pode receber quota.','ADMIN1',?,NULL,?)''', (now, now))
    raise AssertionError('Unknown student policy accepted')
except sqlite3.IntegrityError:
    pass

# Limites/versionamento são imutáveis; só arquivamento é permitido.
try:
    conn.execute("UPDATE academy_tutor_usage_policies SET max_provider_requests=9 WHERE id='QP1'")
    raise AssertionError('Active policy limits were mutated in place')
except sqlite3.IntegrityError:
    pass

# Primeira reserva ocupa o único slot de concorrência.
conn.execute('''INSERT INTO academy_tutor_usage_reservations
  (id,tenant_id,student_id,course_id,request_chars,status,created_at,expires_at,finalized_at)
  VALUES ('R1','T1','U1','C1',600,'reserved',?,?,NULL)''', (now, expires))

try:
    conn.execute('''INSERT INTO academy_tutor_usage_reservations
      (id,tenant_id,student_id,course_id,request_chars,status,created_at,expires_at,finalized_at)
      VALUES ('R2','T1','U1','C1',100,'reserved',?,?,NULL)''', (now, expires))
    raise AssertionError('Concurrent reservation exceeded request limit')
except sqlite3.IntegrityError:
    pass

# Consome a reserva e registra a tentativa real.
conn.execute("UPDATE academy_tutor_usage_reservations SET status='consumed',finalized_at=? WHERE id='R1'", (now,))
conn.execute('''INSERT INTO academy_tutor_provider_events
  (id,tenant_id,session_id,student_id,course_id,provider_mode,outcome,latency_ms,evidence_count,
   citation_count,request_chars,response_chars,fallback_reason,created_at,reservation_id)
  VALUES ('E1','T1','S1','U1','C1','gateway_v1','success',100,2,1,600,220,NULL,?,'R1')''', (now,))

# O consumo histórico passa a bloquear nova reserva no mesmo período.
try:
    conn.execute('''INSERT INTO academy_tutor_usage_reservations
      (id,tenant_id,student_id,course_id,request_chars,status,created_at,expires_at,finalized_at)
      VALUES ('R3','T1','U1','C1',100,'reserved',?,?,NULL)''', (now, expires))
    raise AssertionError('Reservation exceeded consumed daily quota')
except sqlite3.IntegrityError:
    pass

# Um evento real sem reserva consumida correspondente é recusado.
try:
    conn.execute('''INSERT INTO academy_tutor_provider_events
      (id,tenant_id,session_id,student_id,course_id,provider_mode,outcome,latency_ms,evidence_count,
       citation_count,request_chars,response_chars,fallback_reason,created_at,reservation_id)
      VALUES ('E_BAD','T1','S1','U1','C1','gateway_v1','provider_error',20,1,0,100,0,'x',?,NULL)''', (now,))
    raise AssertionError('Provider event accepted without consumed reservation')
except sqlite3.IntegrityError:
    pass

# Guardrail armazena apenas códigos/flags e é append-only.
conn.execute('''INSERT INTO academy_tutor_guardrail_events
  (id,tenant_id,session_id,student_id,course_id,event_type,reason_code,risk_flags_json,policy_id,
   provider_blocked,question_chars,evidence_count,created_at)
  VALUES ('G1','T1','S1','U1','C1','prompt_risk','external_generation_prompt_risk',
          '["prompt_exfiltration"]',NULL,1,50,2,?)''', (now,))

try:
    conn.execute('''INSERT INTO academy_tutor_guardrail_events
      (id,tenant_id,session_id,student_id,course_id,event_type,reason_code,risk_flags_json,policy_id,
       provider_blocked,question_chars,evidence_count,created_at)
      VALUES ('G_BAD','T2','S1','U1','C1','quota_block','provider_requests_limit','[]',NULL,1,20,1,?)''', (now,))
    raise AssertionError('Cross-tenant guardrail accepted')
except sqlite3.IntegrityError:
    pass

for sql in [
    "UPDATE academy_tutor_guardrail_events SET reason_code='alterado' WHERE id='G1'",
    "DELETE FROM academy_tutor_guardrail_events WHERE id='G1'",
]:
    try:
        conn.execute(sql)
        raise AssertionError('Guardrail history was mutable')
    except sqlite3.IntegrityError:
        pass

# Nova regra exige arquivar a versão anterior e criar outra versão, nunca editar histórico.
archived = '2026-09-09T19:10:00.000Z'
conn.execute("UPDATE academy_tutor_usage_policies SET status='archived',archived_at=? WHERE id='QP1'", (archived,))
conn.execute('''INSERT INTO academy_tutor_usage_policies
  (id,tenant_id,scope_type,scope_id,period,version,max_provider_requests,max_request_chars,status,
   rationale,approved_by,approved_at,archived_at,created_at)
  VALUES ('QP2','T1','tenant',NULL,'day',2,2,2500,'active',
          'Segunda versão explícita para o novo período operacional.','ADMIN1',?,NULL,?)''', (archived, archived))

row = conn.execute("SELECT version,status,max_provider_requests FROM academy_tutor_usage_policies WHERE id='QP2'").fetchone()
assert row == (2, 'active', 2)

try:
    conn.execute("UPDATE academy_tutor_usage_policies SET rationale='Mudança indevida' WHERE id='QP1'")
    raise AssertionError('Archived policy was mutated')
except sqlite3.IntegrityError:
    pass

conn.close()
print('AI Tutor usage quotas and prompt guardrails integration fixture: PASS')
