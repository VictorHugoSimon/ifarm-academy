from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / 'migrations').glob('*.sql'))


def apply_migrations(db: sqlite3.Connection) -> None:
    for migration in MIGRATIONS:
        db.executescript(migration.read_text(encoding='utf-8'))


def expect_integrity(db: sqlite3.Connection, sql: str, params: tuple, expected: str) -> None:
    try:
        db.execute(sql, params)
    except sqlite3.IntegrityError as exc:
        if expected not in str(exc):
            raise AssertionError(f'Expected {expected!r}, got {exc!r}') from exc
    else:
        raise AssertionError(f'Expected integrity error containing {expected!r}')


def main() -> None:
    db = sqlite3.connect(':memory:')
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    apply_migrations(db)

    tenant = 'TENANT-EVENT'
    now = '2026-09-02T12:00:00.000Z'
    starts = '2026-09-10T11:00:00.000Z'
    ends = '2026-09-10T20:00:00.000Z'

    db.execute(
        '''INSERT INTO academy_companies (
          id, tenant_id, name, status, created_by, created_at, updated_at
        ) VALUES ('COMPANY-EVENT', ?, 'Fazenda Escola iFarm', 'active', 'admin', ?, ?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_events (
          id,tenant_id,title,description,event_type,modality,status,access_model,
          price_cents,currency,starts_at,ends_at,timezone,registration_deadline,
          capacity,venue_name,address_text,meeting_url,smart_farm_experience,
          created_by,published_at,created_at,updated_at
        ) VALUES ('EVENT-SMART',?,'Smart Farm Experience','Dia de campo','field_day','in_person','published','free',
          NULL,'BRL',?,?, 'America/Sao_Paulo','2026-09-09T20:00:00.000Z',1,
          'Smart Farm iFarm','Penápolis/SP',NULL,1,'admin',?,?,?)''',
        (tenant, starts, ends, now, now, now),
    )
    db.execute(
        '''INSERT INTO academy_events (
          id,tenant_id,title,description,event_type,modality,status,access_model,
          price_cents,currency,starts_at,ends_at,timezone,capacity,smart_farm_experience,
          created_by,published_at,created_at,updated_at
        ) VALUES ('EVENT-OTHER',?,'Webinar IA','Online','webinar','online','published','sponsored',
          NULL,'BRL',?,?, 'America/Sao_Paulo',100,0,'admin',?,?,?)''',
        (tenant, starts, ends, now, now, now),
    )

    db.execute(
        '''INSERT INTO academy_event_registrations (
          id,tenant_id,event_id,user_id,display_name_snapshot,company_id,status,source,
          marketing_consent,registered_at,updated_at
        ) VALUES ('REG-1',?,'EVENT-SMART','USER-1','Participante 1','COMPANY-EVENT','registered','academy',1,?,?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_event_registrations (
          id,tenant_id,event_id,user_id,display_name_snapshot,status,source,
          marketing_consent,registered_at,updated_at
        ) VALUES ('REG-2',?,'EVENT-SMART','USER-2','Participante 2','waitlisted','academy',0,?,?)''',
        (tenant, now, now),
    )

    counts = db.execute(
        '''SELECT
          SUM(CASE WHEN status IN ('registered','attended') THEN 1 ELSE 0 END) occupied,
          SUM(CASE WHEN status='waitlisted' THEN 1 ELSE 0 END) waitlisted
        FROM academy_event_registrations WHERE event_id='EVENT-SMART' '''
    ).fetchone()
    assert counts['occupied'] == 1
    assert counts['waitlisted'] == 1

    checkin = '2026-09-10T11:05:00.000Z'
    db.execute(
        "UPDATE academy_event_registrations SET status='attended',checkin_at=?,updated_at=? WHERE id='REG-1'",
        (checkin, checkin),
    )
    db.execute(
        '''INSERT INTO academy_event_attendance_evidence (
          id,tenant_id,event_id,registration_id,evidence_type,evidence_json,recorded_by,created_at
        ) VALUES ('EVIDENCE-1',?,'EVENT-SMART','REG-1','manual','{"source":"fixture"}','admin',?)''',
        (tenant, checkin),
    )
    attended = db.execute("SELECT status,checkin_at FROM academy_event_registrations WHERE id='REG-1'").fetchone()
    assert tuple(attended) == ('attended', checkin)
    assert db.execute("SELECT COUNT(*) FROM academy_event_attendance_evidence WHERE registration_id='REG-1'").fetchone()[0] == 1

    expect_integrity(
        db,
        '''INSERT INTO academy_event_registrations (
          id,tenant_id,event_id,user_id,display_name_snapshot,status,source,marketing_consent,registered_at,updated_at
        ) VALUES ('REG-DUP',?,'EVENT-SMART','USER-1','Duplicado','registered','academy',0,?,?)''',
        (tenant, now, now),
        'UNIQUE constraint failed',
    )

    expect_integrity(
        db,
        '''INSERT INTO academy_event_registrations (
          id,tenant_id,event_id,user_id,display_name_snapshot,status,source,marketing_consent,registered_at,updated_at
        ) VALUES ('REG-CROSS','TENANT-B','EVENT-SMART','USER-X','Cross','registered','academy',0,?,?)''',
        (now, now),
        'academy_event_registrations tenant/event mismatch',
    )

    db.execute(
        '''INSERT INTO academy_companies (
          id, tenant_id, name, status, created_by, created_at, updated_at
        ) VALUES ('COMPANY-B','TENANT-B','Outra Empresa','active','admin',?,?)''',
        (now, now),
    )
    expect_integrity(
        db,
        '''INSERT INTO academy_event_registrations (
          id,tenant_id,event_id,user_id,display_name_snapshot,company_id,status,source,marketing_consent,registered_at,updated_at
        ) VALUES ('REG-COMPANY',?,'EVENT-SMART','USER-3','Empresa errada','COMPANY-B','registered','academy',0,?,?)''',
        (tenant, now, now),
        'academy_event_registrations tenant/company mismatch',
    )

    expect_integrity(
        db,
        '''INSERT INTO academy_event_attendance_evidence (
          id,tenant_id,event_id,registration_id,evidence_type,evidence_json,recorded_by,created_at
        ) VALUES ('EVIDENCE-CROSS',?,'EVENT-OTHER','REG-1','manual','{}','admin',?)''',
        (tenant, now),
        'academy_event_attendance tenant/registration mismatch',
    )

    violations = db.execute('PRAGMA foreign_key_check').fetchall()
    assert not violations, violations
    print('PASS integration_events_contract: Smart Farm event, waitlist, attendance evidence and tenant isolation')
    db.close()


if __name__ == '__main__':
    main()
