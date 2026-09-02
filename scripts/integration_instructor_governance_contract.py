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

    tenant = 'TENANT-TECH'
    now = '2026-09-02T20:00:00.000Z'
    future = '2030-12-31T23:59:59.000Z'

    db.execute(
        '''INSERT INTO academy_courses (
          id,tenant_id,title,status,quiz_enabled,minimum_score,attempts_allowed,
          created_by,updated_by,created_at,updated_at,instructor_label,certificate_type
        ) VALUES ('COURSE-TECH',?,'NR-31 Operacional','draft',0,0,1,'admin','admin',?,?,'Equipe Técnica','corporate_training')''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_instructors (
          id,tenant_id,user_id,display_name_snapshot,bio,status,created_by,created_at,updated_at
        ) VALUES ('INSTRUCTOR-A',?,'USER-TECH-A','Profissional A','','active','admin',?,?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_instructors (
          id,tenant_id,user_id,display_name_snapshot,bio,status,created_by,created_at,updated_at
        ) VALUES ('INSTRUCTOR-B',?,'USER-TECH-B','Profissional B','','active','admin',?,?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_instructor_qualifications (
          id,tenant_id,instructor_id,qualification_type,title,institution,verification_status,
          declared_by,verified_by,verified_at,verification_note,expires_at,created_at,updated_at
        ) VALUES ('QUAL-VERIFIED',?,'INSTRUCTOR-A','technical','Técnico em Segurança do Trabalho','Instituição A','verified',
          'admin','admin',?,'Documentação conferida',?,?,?)''',
        (tenant, now, future, now, now),
    )
    db.execute(
        '''INSERT INTO academy_instructor_qualifications (
          id,tenant_id,instructor_id,qualification_type,title,verification_status,
          declared_by,created_at,updated_at
        ) VALUES ('QUAL-DECLARED',?,'INSTRUCTOR-A','certification','Curso complementar','declared','admin',?,?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_instructor_qualifications (
          id,tenant_id,instructor_id,qualification_type,title,verification_status,
          declared_by,verified_by,verified_at,expires_at,created_at,updated_at
        ) VALUES ('QUAL-B',?,'INSTRUCTOR-B','degree','Engenharia Agronômica','verified','admin','admin',?,?,?,?)''',
        (tenant, now, future, now, now),
    )

    expect_integrity(
        db,
        '''INSERT INTO academy_course_instructor_roles (
          id,tenant_id,course_id,instructor_id,role,qualification_id,suitability_confirmed,
          suitability_confirmed_by,suitability_confirmed_at,suitability_note,status,assigned_by,created_at,updated_at
        ) VALUES ('ROLE-NO-CONFIRM',?,'COURSE-TECH','INSTRUCTOR-A','technical_responsible','QUAL-VERIFIED',0,
          NULL,NULL,NULL,'active','admin',?,?)''',
        (tenant, now, now),
        'technical responsibility requires explicit suitability confirmation',
    )

    expect_integrity(
        db,
        '''INSERT INTO academy_course_instructor_roles (
          id,tenant_id,course_id,instructor_id,role,qualification_id,suitability_confirmed,
          suitability_confirmed_by,suitability_confirmed_at,suitability_note,status,assigned_by,created_at,updated_at
        ) VALUES ('ROLE-UNVERIFIED',?,'COURSE-TECH','INSTRUCTOR-A','technical_responsible','QUAL-DECLARED',1,
          'admin',?,'Confirmação humana','active','admin',?,?)''',
        (tenant, now, now, now),
        'technical responsibility requires verified current qualification',
    )

    expect_integrity(
        db,
        '''INSERT INTO academy_course_instructor_roles (
          id,tenant_id,course_id,instructor_id,role,qualification_id,suitability_confirmed,
          suitability_confirmed_by,suitability_confirmed_at,suitability_note,status,assigned_by,created_at,updated_at
        ) VALUES ('ROLE-WRONG-QUAL',?,'COURSE-TECH','INSTRUCTOR-A','technical_responsible','QUAL-B',1,
          'admin',?,'Confirmação humana','active','admin',?,?)''',
        (tenant, now, now, now),
        'academy_course_instructor_roles qualification mismatch',
    )

    db.execute(
        '''INSERT INTO academy_course_instructor_roles (
          id,tenant_id,course_id,instructor_id,role,qualification_id,suitability_confirmed,
          suitability_confirmed_by,suitability_confirmed_at,suitability_note,status,assigned_by,created_at,updated_at
        ) VALUES ('ROLE-VALID',?,'COURSE-TECH','INSTRUCTOR-A','technical_responsible','QUAL-VERIFIED',1,
          'admin',?,'Adequação ao escopo confirmada humanamente; verificar norma aplicável antes da oferta.','active','admin',?,?)''',
        (tenant, now, now, now),
    )
    valid = db.execute(
        "SELECT role,qualification_id,suitability_confirmed,status FROM academy_course_instructor_roles WHERE id='ROLE-VALID'"
    ).fetchone()
    assert tuple(valid) == ('technical_responsible', 'QUAL-VERIFIED', 1, 'active')

    expect_integrity(
        db,
        '''INSERT INTO academy_course_instructor_roles (
          id,tenant_id,course_id,instructor_id,role,status,assigned_by,created_at,updated_at
        ) VALUES ('ROLE-CROSS','TENANT-B','COURSE-TECH','INSTRUCTOR-A','instructor','active','admin',?,?)''',
        (now, now),
        'academy_course_instructor_roles tenant/course mismatch',
    )

    expect_integrity(
        db,
        '''INSERT INTO academy_course_instructor_roles (
          id,tenant_id,course_id,instructor_id,role,qualification_id,suitability_confirmed,
          suitability_confirmed_by,suitability_confirmed_at,suitability_note,status,assigned_by,created_at,updated_at
        ) VALUES ('ROLE-DUP',?,'COURSE-TECH','INSTRUCTOR-A','technical_responsible','QUAL-VERIFIED',1,
          'admin',?,'Duplicado','active','admin',?,?)''',
        (tenant, now, now, now),
        'UNIQUE constraint failed',
    )

    violations = db.execute('PRAGMA foreign_key_check').fetchall()
    assert not violations, violations
    print('PASS integration_instructor_governance_contract: verified qualification, explicit suitability and tenant isolation')
    db.close()


if __name__ == '__main__':
    main()
