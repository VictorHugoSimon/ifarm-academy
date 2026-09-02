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
    db.execute('PRAGMA foreign_keys = ON')
    apply_migrations(db)
    now = '2026-09-02T17:30:00.000Z'

    db.execute(
        """INSERT INTO academy_courses (
          id, tenant_id, title, status, quiz_enabled, minimum_score, attempts_allowed,
          created_by, updated_by, created_at, updated_at, instructor_label, certificate_type
        ) VALUES ('COURSE-B2B','TENANT-A','NR-31','published',0,0,1,'admin','admin',?,?, 'Responsável Técnico','corporate_training')""",
        (now, now),
    )
    db.execute(
        """INSERT INTO academy_companies (
          id, tenant_id, name, status, created_by, created_at, updated_at
        ) VALUES ('COMPANY-A','TENANT-A','Fazenda Escola','active','admin',?,?)""",
        (now, now),
    )
    db.execute(
        """INSERT INTO academy_company_members (
          id, tenant_id, company_id, user_id, display_name_snapshot, status, created_at, updated_at
        ) VALUES ('MEMBER-A','TENANT-A','COMPANY-A','USER-A','Colaborador A','active',?,?)""",
        (now, now),
    )
    db.execute(
        """INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, status,
          source, assigned_by, assigned_at, updated_at
        ) VALUES ('ASSIGN-A','TENANT-A','COMPANY-A','MEMBER-A','COURSE-B2B',1,'assigned','company_admin','admin',?,?)""",
        (now, now),
    )

    row = db.execute(
        "SELECT company_id, member_id, course_id, required, status FROM academy_course_assignments WHERE id='ASSIGN-A'"
    ).fetchone()
    assert row == ('COMPANY-A', 'MEMBER-A', 'COURSE-B2B', 1, 'assigned')

    expect_integrity(
        db,
        """INSERT INTO academy_company_members (
          id, tenant_id, company_id, user_id, display_name_snapshot, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)""",
        ('MEMBER-CROSS', 'TENANT-B', 'COMPANY-A', 'USER-B', 'Cross Tenant', now, now),
        'academy_company_members tenant/company mismatch',
    )

    expect_integrity(
        db,
        """INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, status,
          source, assigned_by, assigned_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, 'assigned', 'company_admin', 'admin', ?, ?)""",
        ('ASSIGN-CROSS', 'TENANT-B', 'COMPANY-A', 'MEMBER-A', 'COURSE-B2B', now, now),
        'academy_course_assignments tenant/company mismatch',
    )

    expect_integrity(
        db,
        """INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, status,
          source, assigned_by, assigned_at, updated_at
        ) VALUES (?, 'TENANT-A', 'COMPANY-A', 'MEMBER-A', 'COURSE-B2B', 1, 'assigned', 'company_admin', 'admin', ?, ?)""",
        ('ASSIGN-DUP', now, now),
        'UNIQUE constraint failed',
    )

    db.execute("UPDATE academy_course_assignments SET status='cancelled' WHERE id='ASSIGN-A'")
    db.execute(
        """INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, status,
          source, assigned_by, assigned_at, updated_at
        ) VALUES ('ASSIGN-RENEW','TENANT-A','COMPANY-A','MEMBER-A','COURSE-B2B',1,'assigned','company_admin','admin',?,?)""",
        (now, now),
    )
    assert db.execute("SELECT COUNT(*) FROM academy_course_assignments WHERE status='assigned'").fetchone()[0] == 1

    violations = db.execute('PRAGMA foreign_key_check').fetchall()
    assert not violations, violations
    print('PASS integration_enterprise_contract: company, member, assignment and tenant isolation')
    db.close()


if __name__ == '__main__':
    main()
