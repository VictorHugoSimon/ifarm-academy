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
    now = '2026-09-02T18:00:00.000Z'
    completed_at = '2025-09-01T18:00:00.000Z'

    for course_id, title in [('COURSE-P1', 'Segurança Rural'), ('COURSE-P2', 'Operação de Máquinas')]:
        db.execute(
            """INSERT INTO academy_courses (
              id, tenant_id, title, status, quiz_enabled, minimum_score, attempts_allowed,
              created_by, updated_by, created_at, updated_at, instructor_label, certificate_type
            ) VALUES (?, 'TENANT-A', ?, 'published', 0, 0, 1, 'admin', 'admin', ?, ?, 'Equipe Técnica', 'corporate_training')""",
            (course_id, title, now, now),
        )

    db.execute(
        """INSERT INTO academy_companies (
          id, tenant_id, name, status, created_by, created_at, updated_at
        ) VALUES ('COMPANY-P','TENANT-A','Fazenda Caminho Seguro','active','admin',?,?)""",
        (now, now),
    )
    db.execute(
        """INSERT INTO academy_company_members (
          id, tenant_id, company_id, user_id, display_name_snapshot, status, created_at, updated_at
        ) VALUES ('MEMBER-P','TENANT-A','COMPANY-P','USER-P','Colaborador Trilha','active',?,?)""",
        (now, now),
    )
    db.execute(
        """INSERT INTO academy_company_learning_paths (
          id, tenant_id, company_id, name, status, default_renewal_months,
          created_by, created_at, updated_at
        ) VALUES ('PATH-P','TENANT-A','COMPANY-P','Integração Segura','active',12,'admin',?,?)""",
        (now, now),
    )
    db.execute(
        """INSERT INTO academy_company_learning_path_courses (
          id, tenant_id, company_id, path_id, course_id, position, required, renewal_months, created_at
        ) VALUES ('PATHCOURSE-1','TENANT-A','COMPANY-P','PATH-P','COURSE-P1',0,1,12,?)""",
        (now,),
    )
    db.execute(
        """INSERT INTO academy_company_learning_path_courses (
          id, tenant_id, company_id, path_id, course_id, position, required, renewal_months, created_at
        ) VALUES ('PATHCOURSE-2','TENANT-A','COMPANY-P','PATH-P','COURSE-P2',1,1,NULL,?)""",
        (now,),
    )
    db.execute(
        """INSERT INTO academy_company_path_assignments (
          id, tenant_id, company_id, path_id, member_id, status, due_at,
          assigned_by, assigned_at, updated_at
        ) VALUES ('PATHASSIGN-P','TENANT-A','COMPANY-P','PATH-P','MEMBER-P','in_progress',?,'admin',?,?)""",
        ('2026-10-01T18:00:00.000Z', now, now),
    )

    db.execute(
        """INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, status,
          source, assigned_by, assigned_at, completed_at, updated_at,
          renewal_months, renewal_cycle
        ) VALUES ('COURSEASSIGN-P1','TENANT-A','COMPANY-P','MEMBER-P','COURSE-P1',1,'completed',
          'company_path:PATHASSIGN-P','admin',?,?,?,12,1)""",
        (completed_at, completed_at, completed_at),
    )
    db.execute(
        """INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, status,
          source, assigned_by, assigned_at, updated_at, renewal_months, renewal_cycle
        ) VALUES ('COURSEASSIGN-P2','TENANT-A','COMPANY-P','MEMBER-P','COURSE-P2',1,'assigned',
          'company_path:PATHASSIGN-P','admin',?,?,NULL,1)""",
        (now, now),
    )
    db.execute(
        """INSERT INTO academy_company_path_assignment_courses (
          id, tenant_id, company_id, path_assignment_id, path_course_id, course_assignment_id, created_at
        ) VALUES ('LINK-P1','TENANT-A','COMPANY-P','PATHASSIGN-P','PATHCOURSE-1','COURSEASSIGN-P1',?)""",
        (now,),
    )
    db.execute(
        """INSERT INTO academy_company_path_assignment_courses (
          id, tenant_id, company_id, path_assignment_id, path_course_id, course_assignment_id, created_at
        ) VALUES ('LINK-P2','TENANT-A','COMPANY-P','PATHASSIGN-P','PATHCOURSE-2','COURSEASSIGN-P2',?)""",
        (now,),
    )

    path = db.execute(
        "SELECT name, default_renewal_months, status FROM academy_company_learning_paths WHERE id='PATH-P'"
    ).fetchone()
    assert path == ('Integração Segura', 12, 'active')
    assert db.execute("SELECT COUNT(*) FROM academy_company_learning_path_courses WHERE path_id='PATH-P'").fetchone()[0] == 2
    assert db.execute("SELECT COUNT(*) FROM academy_company_path_assignment_courses WHERE path_assignment_id='PATHASSIGN-P'").fetchone()[0] == 2

    completed = db.execute(
        "SELECT renewal_months, renewal_cycle, completed_at FROM academy_course_assignments WHERE id='COURSEASSIGN-P1'"
    ).fetchone()
    assert completed == (12, 1, completed_at)

    # Um novo ciclo concluído é permitido para preservar histórico.
    db.execute(
        """INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, status,
          source, assigned_by, assigned_at, completed_at, updated_at,
          renewal_months, renewal_of_assignment_id, renewal_cycle
        ) VALUES ('COURSEASSIGN-P1-CYCLE2','TENANT-A','COMPANY-P','MEMBER-P','COURSE-P1',1,'completed',
          'renewal','admin',?,?,?,12,'COURSEASSIGN-P1',2)""",
        (now, now, now),
    )
    assert db.execute(
        "SELECT COUNT(*) FROM academy_course_assignments WHERE member_id='MEMBER-P' AND course_id='COURSE-P1' AND status='completed'"
    ).fetchone()[0] == 2

    # Apenas uma atribuição aberta por curso/colaborador pode existir.
    expect_integrity(
        db,
        """INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, status,
          source, assigned_by, assigned_at, updated_at, renewal_cycle
        ) VALUES (?, 'TENANT-A','COMPANY-P','MEMBER-P','COURSE-P2',1,'in_progress','renewal','admin',?,?,2)""",
        ('COURSEASSIGN-P2-DUP', now, now),
        'UNIQUE constraint failed',
    )

    expect_integrity(
        db,
        """INSERT INTO academy_company_learning_paths (
          id, tenant_id, company_id, name, status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'active', 'admin', ?, ?)""",
        ('PATH-CROSS', 'TENANT-B', 'COMPANY-P', 'Cross Tenant', now, now),
        'academy_company_learning_paths tenant/company mismatch',
    )

    expect_integrity(
        db,
        """INSERT INTO academy_company_learning_path_courses (
          id, tenant_id, company_id, path_id, course_id, position, required, created_at
        ) VALUES (?, ?, ?, ?, ?, 2, 1, ?)""",
        ('PATHCOURSE-CROSS', 'TENANT-B', 'COMPANY-P', 'PATH-P', 'COURSE-P1', now),
        'academy_company_learning_path_courses tenant/path mismatch',
    )

    violations = db.execute('PRAGMA foreign_key_check').fetchall()
    assert not violations, violations
    print('PASS integration_enterprise_paths_contract: paths, cycles, uniqueness and tenant isolation')
    db.close()


if __name__ == '__main__':
    main()
