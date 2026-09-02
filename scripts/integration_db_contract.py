from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / 'migrations').glob('*.sql'))


def apply_migrations(connection: sqlite3.Connection) -> None:
    for migration in MIGRATIONS:
        connection.executescript(migration.read_text(encoding='utf-8'))


def expect_integrity_error(connection: sqlite3.Connection, sql: str, params: tuple, expected: str) -> None:
    try:
        connection.execute(sql, params)
    except sqlite3.IntegrityError as exc:
        if expected not in str(exc):
            raise AssertionError(f'Expected {expected!r}, got {exc!r}') from exc
    else:
        raise AssertionError(f'Expected sqlite3.IntegrityError containing {expected!r}')


def main() -> None:
    db = sqlite3.connect(':memory:')
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    apply_migrations(db)

    tenant = 'TENANT-A'
    other_tenant = 'TENANT-B'
    now = '2026-09-02T12:00:00.000Z'

    db.execute(
        '''INSERT INTO academy_courses (
          id, tenant_id, title, description, status, quiz_enabled, minimum_score,
          attempts_allowed, created_by, updated_by, created_at, updated_at,
          instructor_label, certificate_type
        ) VALUES (?, ?, ?, ?, 'published', 0, 0, 1, ?, ?, ?, ?, ?, ?)''',
        ('COURSE-A', tenant, 'Agricultura Digital', 'Curso de teste', 'admin-a', 'admin-a', now, now, 'Equipe Técnica iFarm', 'free_course'),
    )
    db.execute(
        '''INSERT INTO academy_course_modules (
          id, tenant_id, course_id, title, description, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)''',
        ('MODULE-A', tenant, 'COURSE-A', 'Fundamentos', '', now, now),
    )
    db.execute(
        '''INSERT INTO academy_course_lessons (
          id, tenant_id, course_id, module_id, title, content_type,
          duration_minutes, required, position, content_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'text', 60, 1, 0, ?, ?, ?)''',
        ('LESSON-A', tenant, 'COURSE-A', 'MODULE-A', 'Introdução', '{"body":"conteudo"}', now, now),
    )
    db.execute(
        '''INSERT INTO academy_course_completion_policy (
          course_id, required_lessons_count, assessment_required, quiz_id,
          minimum_score, updated_at, tenant_id, course_title
        ) VALUES (?, 1, 0, NULL, NULL, ?, ?, ?)''',
        ('COURSE-A', now, tenant, 'Agricultura Digital'),
    )
    db.execute(
        '''INSERT INTO academy_enrollments (
          id, tenant_id, course_id, student_id, student_name_snapshot,
          source, status, enrolled_at, completed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'academy', 'completed', ?, ?, ?)''',
        ('ENROLL-A', tenant, 'COURSE-A', 'STUDENT-A', 'Aluno Teste', now, now, now),
    )
    db.execute(
        '''INSERT INTO academy_progress (
          student_id, course_id, lesson_id, progress_percent, completed_at,
          updated_at, tenant_id, last_position_seconds
        ) VALUES (?, ?, ?, 100, ?, ?, ?, 3600)''',
        ('STUDENT-A', 'COURSE-A', 'LESSON-A', now, now, tenant),
    )
    db.execute(
        '''INSERT INTO academy_certificates (
          id, public_code, student_id, student_name, course_id, course_title,
          final_score, issued_at, status, tenant_id, workload_minutes,
          instructor_label, certificate_type, completion_date, metadata_version
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'valid', ?, 60, ?, 'free_course', ?, 1)''',
        ('CERT-A', 'IFA-2026-INTEGRATION', 'STUDENT-A', 'Aluno Teste', 'COURSE-A', 'Agricultura Digital', now, tenant, 'Equipe Técnica iFarm', now),
    )

    certificate = db.execute(
        '''SELECT public_code, student_name, course_title, workload_minutes,
                  instructor_label, certificate_type, status
           FROM academy_certificates WHERE public_code=?''',
        ('IFA-2026-INTEGRATION',),
    ).fetchone()
    assert certificate is not None
    assert certificate['status'] == 'valid'
    assert certificate['student_name'] == 'Aluno Teste'
    assert certificate['course_title'] == 'Agricultura Digital'
    assert certificate['workload_minutes'] == 60
    assert certificate['instructor_label'] == 'Equipe Técnica iFarm'
    assert certificate['certificate_type'] == 'free_course'

    expect_integrity_error(
        db,
        '''INSERT INTO academy_enrollments (
          id, tenant_id, course_id, student_id, source, status,
          enrolled_at, updated_at
        ) VALUES (?, ?, ?, ?, 'academy', 'active', ?, ?)''',
        ('ENROLL-CROSS', other_tenant, 'COURSE-A', 'STUDENT-X', now, now),
        'academy_enrollments tenant/course mismatch',
    )

    expect_integrity_error(
        db,
        '''INSERT INTO academy_progress (
          student_id, course_id, lesson_id, progress_percent,
          updated_at, tenant_id, last_position_seconds
        ) VALUES (?, ?, ?, 10, ?, ?, 10)''',
        ('STUDENT-X', 'COURSE-A', 'LESSON-A', now, other_tenant),
        'academy_progress tenant/course/lesson mismatch',
    )

    expect_integrity_error(
        db,
        '''INSERT INTO academy_certificates (
          id, public_code, student_id, student_name, course_id, course_title,
          issued_at, status, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'valid', ?)''',
        ('CERT-CROSS', 'IFA-2026-CROSS', 'STUDENT-X', 'Cross Tenant', 'COURSE-A', 'Agricultura Digital', now, other_tenant),
        'academy_certificates tenant/course mismatch',
    )

    violations = db.execute('PRAGMA foreign_key_check').fetchall()
    assert not violations, violations

    print('PASS integration_db_contract: fixtures, certificate snapshot and tenant isolation')
    db.close()


if __name__ == '__main__':
    main()
