from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / 'migrations').glob('*.sql'))
CYCLE_MIGRATION = ROOT / 'migrations' / '0014_learning_cycles.sql'


def apply_before_cycles(db: sqlite3.Connection) -> None:
    for migration in MIGRATIONS:
        if migration.name == CYCLE_MIGRATION.name:
            break
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
    apply_before_cycles(db)

    tenant = 'TENANT-CYCLE'
    now = '2026-09-02T18:00:00.000Z'
    completed_at = '2025-09-01T18:00:00.000Z'

    db.execute(
        '''INSERT INTO academy_courses (
          id, tenant_id, title, description, status, quiz_enabled, minimum_score,
          attempts_allowed, created_by, updated_by, created_at, updated_at,
          instructor_label, certificate_type
        ) VALUES ('COURSE-CYCLE', ?, 'Treinamento Recorrente', '', 'published', 1, 70, 2,
          'admin', 'admin', ?, ?, 'Equipe Técnica', 'corporate_training')''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_course_modules (
          id, tenant_id, course_id, title, description, position, created_at, updated_at
        ) VALUES ('MODULE-CYCLE', ?, 'COURSE-CYCLE', 'Módulo', '', 0, ?, ?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_course_lessons (
          id, tenant_id, course_id, module_id, title, content_type, duration_minutes,
          required, position, content_json, created_at, updated_at
        ) VALUES ('LESSON-CYCLE', ?, 'COURSE-CYCLE', 'MODULE-CYCLE', 'Aula', 'text', 60,
          1, 0, '{}', ?, ?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_course_completion_policy (
          course_id, required_lessons_count, assessment_required, quiz_id,
          minimum_score, updated_at, tenant_id, course_title
        ) VALUES ('COURSE-CYCLE', 1, 1, 'QUIZ-CYCLE', 70, ?, ?, 'Treinamento Recorrente')''',
        (now, tenant),
    )
    db.execute(
        '''INSERT INTO academy_quiz_policies (
          quiz_id, course_id, status, minimum_score, attempts_allowed,
          randomize_questions, questions_json, version, published_at, updated_at, tenant_id
        ) VALUES ('QUIZ-CYCLE', 'COURSE-CYCLE', 'published', 70, 2, 0, '[]', 1, ?, ?, ?)''',
        (now, now, tenant),
    )
    db.execute(
        '''INSERT INTO academy_enrollments (
          id, tenant_id, course_id, student_id, student_name_snapshot, source,
          status, enrolled_at, completed_at, updated_at
        ) VALUES ('ENROLL-CYCLE', ?, 'COURSE-CYCLE', 'STUDENT-CYCLE', 'Aluno Ciclo',
          'company_assignment', 'completed', ?, ?, ?)''',
        (tenant, completed_at, completed_at, completed_at),
    )
    db.execute(
        '''INSERT INTO academy_progress (
          student_id, course_id, lesson_id, progress_percent, completed_at,
          updated_at, tenant_id, last_position_seconds
        ) VALUES ('STUDENT-CYCLE', 'COURSE-CYCLE', 'LESSON-CYCLE', 100, ?, ?, ?, 3600)''',
        (completed_at, completed_at, tenant),
    )
    db.execute(
        '''INSERT INTO academy_quiz_attempts (
          id, quiz_id, student_id, attempt_number, status, answers_json,
          automatic_result_json, manual_points, manual_total_points, final_percentage,
          started_at, submitted_at, reviewed_at, reviewer_name, review_note,
          policy_version, tenant_id, student_name_snapshot
        ) VALUES ('ATTEMPT-CYCLE-1', 'QUIZ-CYCLE', 'STUDENT-CYCLE', 1, 'approved', '[]',
          '{}', NULL, NULL, 90, ?, ?, NULL, NULL, NULL, 1, ?, 'Aluno Ciclo')''',
        (completed_at, completed_at, tenant),
    )
    db.execute(
        '''INSERT INTO academy_certificates (
          id, public_code, student_id, student_name, course_id, course_title,
          final_score, issued_at, status, tenant_id, workload_minutes,
          instructor_label, certificate_type, completion_date, metadata_version
        ) VALUES ('CERT-CYCLE-1', 'IFA-CYCLE-1', 'STUDENT-CYCLE', 'Aluno Ciclo',
          'COURSE-CYCLE', 'Treinamento Recorrente', 90, ?, 'valid', ?, 60,
          'Equipe Técnica', 'corporate_training', ?, 1)''',
        (completed_at, tenant, completed_at),
    )
    db.execute(
        '''INSERT INTO academy_companies (
          id, tenant_id, name, status, created_by, created_at, updated_at
        ) VALUES ('COMPANY-CYCLE', ?, 'Fazenda Ciclo', 'active', 'admin', ?, ?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_company_members (
          id, tenant_id, company_id, user_id, display_name_snapshot, status, created_at, updated_at
        ) VALUES ('MEMBER-CYCLE', ?, 'COMPANY-CYCLE', 'STUDENT-CYCLE', 'Aluno Ciclo', 'active', ?, ?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, due_at, status,
          source, assigned_by, assigned_at, completed_at, updated_at,
          renewal_months, renewal_cycle
        ) VALUES ('ASSIGN-CYCLE-1', ?, 'COMPANY-CYCLE', 'MEMBER-CYCLE', 'COURSE-CYCLE', 1,
          NULL, 'completed', 'company_admin', 'admin', ?, ?, ?, 12, 1)''',
        (tenant, completed_at, completed_at, completed_at),
    )

    CYCLE_MIGRATION_SQL = CYCLE_MIGRATION.read_text(encoding='utf-8')
    db.executescript(CYCLE_MIGRATION_SQL)

    cycle1 = 'LC-ENROLL-CYCLE-1'
    enrollment = db.execute(
        "SELECT active_cycle_id, status, completed_at FROM academy_enrollments WHERE id='ENROLL-CYCLE'"
    ).fetchone()
    assert tuple(enrollment) == (cycle1, 'completed', completed_at)

    cycle_row = db.execute(
        "SELECT cycle_number, status, completed_at FROM academy_learning_cycles WHERE id=?",
        (cycle1,),
    ).fetchone()
    assert tuple(cycle_row) == (1, 'completed', completed_at)
    assert db.execute("SELECT cycle_id FROM academy_progress WHERE lesson_id='LESSON-CYCLE'").fetchone()[0] == cycle1
    assert db.execute("SELECT cycle_id FROM academy_quiz_attempts WHERE id='ATTEMPT-CYCLE-1'").fetchone()[0] == cycle1
    assert db.execute("SELECT cycle_id FROM academy_certificates WHERE id='CERT-CYCLE-1'").fetchone()[0] == cycle1
    assert db.execute("SELECT learning_cycle_id FROM academy_course_assignments WHERE id='ASSIGN-CYCLE-1'").fetchone()[0] == cycle1

    cycle2 = 'CYCLE-2'
    started2 = '2026-09-02T18:30:00.000Z'
    db.execute(
        '''INSERT INTO academy_learning_cycles (
          id, tenant_id, enrollment_id, student_id, course_id, cycle_number, status,
          source, company_id, member_id, renewal_of_cycle_id, started_at, created_at, updated_at
        ) VALUES (?, ?, 'ENROLL-CYCLE', 'STUDENT-CYCLE', 'COURSE-CYCLE', 2, 'active',
          'company_renewal:ASSIGN-CYCLE-1', 'COMPANY-CYCLE', 'MEMBER-CYCLE', ?, ?, ?, ?)''',
        (cycle2, tenant, cycle1, started2, started2, started2),
    )
    db.execute(
        '''UPDATE academy_enrollments
           SET active_cycle_id=?, status='active', completed_at=NULL, updated_at=?
           WHERE id='ENROLL-CYCLE' ''',
        (cycle2, started2),
    )
    db.execute(
        '''INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, status, source,
          assigned_by, assigned_at, updated_at, renewal_months,
          renewal_of_assignment_id, renewal_cycle, learning_cycle_id
        ) VALUES ('ASSIGN-CYCLE-2', ?, 'COMPANY-CYCLE', 'MEMBER-CYCLE', 'COURSE-CYCLE', 1,
          'assigned', 'company_renewal:ASSIGN-CYCLE-1', 'admin', ?, ?, 12,
          'ASSIGN-CYCLE-1', 2, ?)''',
        (tenant, started2, started2, cycle2),
    )

    assert db.execute("SELECT COUNT(*) FROM academy_progress WHERE cycle_id=?", (cycle2,)).fetchone()[0] == 0
    assert db.execute("SELECT COUNT(*) FROM academy_quiz_attempts WHERE cycle_id=?", (cycle2,)).fetchone()[0] == 0
    assert db.execute("SELECT COUNT(*) FROM academy_certificates WHERE cycle_id=?", (cycle2,)).fetchone()[0] == 0

    db.execute(
        '''INSERT INTO academy_progress (
          cycle_id, student_id, course_id, lesson_id, progress_percent,
          completed_at, updated_at, tenant_id, last_position_seconds
        ) VALUES (?, 'STUDENT-CYCLE', 'COURSE-CYCLE', 'LESSON-CYCLE', 100, ?, ?, ?, 3600)''',
        (cycle2, started2, started2, tenant),
    )
    db.execute(
        '''INSERT INTO academy_quiz_attempts (
          id, cycle_id, quiz_id, student_id, attempt_number, status, answers_json,
          final_percentage, started_at, submitted_at, policy_version, tenant_id, student_name_snapshot
        ) VALUES ('ATTEMPT-CYCLE-2', ?, 'QUIZ-CYCLE', 'STUDENT-CYCLE', 1, 'approved', '[]',
          95, ?, ?, 1, ?, 'Aluno Ciclo')''',
        (cycle2, started2, started2, tenant),
    )
    assert db.execute(
        "SELECT COUNT(*) FROM academy_quiz_attempts WHERE quiz_id='QUIZ-CYCLE' AND attempt_number=1"
    ).fetchone()[0] == 2

    completed2 = '2026-09-02T19:00:00.000Z'
    db.execute(
        "UPDATE academy_learning_cycles SET status='completed', completed_at=?, updated_at=? WHERE id=?",
        (completed2, completed2, cycle2),
    )
    db.execute(
        "UPDATE academy_enrollments SET status='completed', completed_at=?, updated_at=? WHERE id='ENROLL-CYCLE'",
        (completed2, completed2),
    )
    db.execute(
        "UPDATE academy_course_assignments SET status='completed', completed_at=?, updated_at=? WHERE id='ASSIGN-CYCLE-2'",
        (completed2, completed2),
    )
    db.execute(
        '''INSERT INTO academy_certificates (
          id, cycle_id, public_code, student_id, student_name, course_id, course_title,
          final_score, issued_at, status, tenant_id, workload_minutes,
          instructor_label, certificate_type, completion_date, metadata_version
        ) VALUES ('CERT-CYCLE-2', ?, 'IFA-CYCLE-2', 'STUDENT-CYCLE', 'Aluno Ciclo',
          'COURSE-CYCLE', 'Treinamento Recorrente', 95, ?, 'valid', ?, 60,
          'Equipe Técnica', 'corporate_training', ?, 1)''',
        (cycle2, completed2, tenant, completed2),
    )

    assert db.execute(
        "SELECT COUNT(*) FROM academy_certificates WHERE student_id='STUDENT-CYCLE' AND course_id='COURSE-CYCLE'"
    ).fetchone()[0] == 2
    assert db.execute("SELECT progress_percent FROM academy_progress WHERE cycle_id=?", (cycle1,)).fetchone()[0] == 100
    assert db.execute("SELECT final_percentage FROM academy_quiz_attempts WHERE cycle_id=?", (cycle1,)).fetchone()[0] == 90
    assert db.execute("SELECT status FROM academy_certificates WHERE cycle_id=?", (cycle1,)).fetchone()[0] == 'valid'

    expect_integrity(
        db,
        '''INSERT INTO academy_progress (
          cycle_id, student_id, course_id, lesson_id, progress_percent,
          updated_at, tenant_id, last_position_seconds
        ) VALUES (?, 'OTHER-STUDENT', 'COURSE-CYCLE', 'LESSON-CYCLE', 10, ?, ?, 0)''',
        (cycle2, completed2, tenant),
        'academy_progress cycle mismatch',
    )

    violations = db.execute('PRAGMA foreign_key_check').fetchall()
    assert not violations, violations
    print('PASS integration_learning_cycles_contract: v0.27 backfill, cycle isolation, attempt reset and certificate history')
    db.close()


if __name__ == '__main__':
    main()
