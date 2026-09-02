from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / 'migrations').glob('*.sql'))


def apply_migrations(db: sqlite3.Connection) -> None:
    for migration in MIGRATIONS:
        db.executescript(migration.read_text(encoding='utf-8'))


def scalar(db: sqlite3.Connection, sql: str, params=()):
    row = db.execute(sql, params).fetchone()
    return row[0] if row else None


def main() -> None:
    db = sqlite3.connect(':memory:')
    db.execute('PRAGMA foreign_keys = ON')
    apply_migrations(db)

    tenant = 'TENANT-REPORT'
    now = '2026-09-02T18:00:00.000Z'
    completed = '2026-08-20T18:00:00.000Z'

    for course_id, title, certificate_type in [
        ('COURSE-R1', 'NR-31 Fundamentos', 'regulatory_training'),
        ('COURSE-R2', 'Agricultura Digital', 'free_course'),
    ]:
        db.execute(
            '''INSERT INTO academy_courses (
              id, tenant_id, title, status, quiz_enabled, minimum_score, attempts_allowed,
              created_by, updated_by, created_at, updated_at, instructor_label, certificate_type
            ) VALUES (?, ?, ?, 'published', 0, 0, 1, 'admin', 'admin', ?, ?, 'Equipe Técnica', ?)''',
            (course_id, tenant, title, now, now, certificate_type),
        )

    db.execute(
        '''INSERT INTO academy_enrollments (
          id, tenant_id, course_id, student_id, student_name_snapshot,
          source, status, enrolled_at, completed_at, updated_at, active_cycle_id
        ) VALUES ('ENROLL-R1', ?, 'COURSE-R1', 'STUDENT-R1', 'Aluno Relatório',
          'academy', 'completed', ?, ?, ?, 'CYCLE-R1')''',
        (tenant, completed, completed, completed),
    )
    db.execute(
        '''INSERT INTO academy_learning_cycles (
          id, tenant_id, enrollment_id, student_id, course_id, cycle_number,
          status, source, started_at, completed_at, created_at, updated_at
        ) VALUES ('CYCLE-R1', ?, 'ENROLL-R1', 'STUDENT-R1', 'COURSE-R1', 1,
          'completed', 'academy', ?, ?, ?, ?)''',
        (tenant, completed, completed, completed, completed),
    )
    db.execute(
        '''INSERT INTO academy_certificates (
          id, cycle_id, public_code, student_id, student_name, course_id, course_title,
          issued_at, status, tenant_id, workload_minutes, instructor_label,
          certificate_type, completion_date, metadata_version
        ) VALUES ('CERT-R1','CYCLE-R1','IFA-REPORT-1','STUDENT-R1','Aluno Relatório',
          'COURSE-R1','NR-31 Fundamentos',?,'valid',?,60,'Equipe Técnica',
          'regulatory_training',?,1)''',
        (completed, tenant, completed),
    )

    db.execute(
        '''INSERT INTO academy_companies (
          id, tenant_id, name, status, created_by, created_at, updated_at
        ) VALUES ('COMPANY-R',?,'Fazenda Relatório','active','admin',?,?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_company_members (
          id, tenant_id, company_id, user_id, display_name_snapshot, status, created_at, updated_at
        ) VALUES ('MEMBER-R',?,'COMPANY-R','STUDENT-R1','Aluno Relatório','active',?,?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, status, source,
          assigned_by, assigned_at, completed_at, updated_at, renewal_months,
          renewal_cycle, learning_cycle_id
        ) VALUES ('ASSIGN-R1',?,'COMPANY-R','MEMBER-R','COURSE-R1',1,'completed','company',
          'admin',?,?,?,12,1,'CYCLE-R1')''',
        (tenant, completed, completed, completed),
    )
    db.execute(
        '''INSERT INTO academy_course_assignments (
          id, tenant_id, company_id, member_id, course_id, required, due_at, status, source,
          assigned_by, assigned_at, updated_at, renewal_cycle
        ) VALUES ('ASSIGN-R2',?,'COMPANY-R','MEMBER-R','COURSE-R2',1,
          '2026-08-01T00:00:00.000Z','assigned','company','admin',?,?,1)''',
        (tenant, now, now),
    )

    db.execute(
        '''INSERT INTO academy_events (
          id, tenant_id, title, event_type, modality, status, access_model,
          starts_at, ends_at, smart_farm_experience, created_by, published_at, created_at, updated_at
        ) VALUES ('EVENT-R',?,'Dia de Campo Relatório','field_day','in_person','published','free',
          '2026-09-10T12:00:00.000Z','2026-09-10T18:00:00.000Z',1,'admin',?,?,?)''',
        (tenant, now, now, now),
    )
    for registration_id, user_id, status in [
        ('REG-R1', 'STUDENT-R1', 'registered'),
        ('REG-R2', 'STUDENT-R2', 'waitlisted'),
    ]:
        db.execute(
            '''INSERT INTO academy_event_registrations (
              id, tenant_id, event_id, user_id, display_name_snapshot, status,
              source, marketing_consent, registered_at, updated_at
            ) VALUES (?,?,'EVENT-R',?,?,?,'academy',0,?,?)''',
            (registration_id, tenant, user_id, user_id, status, now, now),
        )

    db.execute(
        '''INSERT INTO academy_instructors (
          id, tenant_id, user_id, display_name_snapshot, status, created_by, created_at, updated_at
        ) VALUES ('INSTR-R',?,'USER-INSTR-R','Responsável Relatório','active','admin',?,?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_instructor_qualifications (
          id, tenant_id, instructor_id, qualification_type, title,
          verification_status, declared_by, verified_by, verified_at, created_at, updated_at
        ) VALUES ('QUAL-R',?,'INSTR-R','technical','Formação verificada',
          'verified','admin','admin',?,?,?)''',
        (tenant, now, now, now),
    )
    db.execute(
        '''INSERT INTO academy_course_instructor_roles (
          id, tenant_id, course_id, instructor_id, role, qualification_id,
          suitability_confirmed, suitability_confirmed_by, suitability_confirmed_at,
          suitability_note, status, assigned_by, created_at, updated_at
        ) VALUES ('ROLE-R',?,'COURSE-R1','INSTR-R','technical_responsible','QUAL-R',
          1,'admin',?,'Validação humana registrada','active','admin',?,?)''',
        (tenant, now, now, now),
    )

    assert scalar(db, "SELECT COUNT(*) FROM academy_courses WHERE tenant_id=? AND status='published'", (tenant,)) == 2
    assert scalar(db, "SELECT COUNT(DISTINCT student_id) FROM academy_enrollments WHERE tenant_id=? AND status!='cancelled'", (tenant,)) == 1
    assert scalar(db, "SELECT COUNT(*) FROM academy_learning_cycles WHERE tenant_id=? AND status='completed'", (tenant,)) == 1
    assert scalar(db, "SELECT COUNT(*) FROM academy_certificates WHERE tenant_id=? AND status='valid'", (tenant,)) == 1
    assert scalar(db, "SELECT COUNT(*) FROM academy_companies WHERE tenant_id=? AND status='active'", (tenant,)) == 1
    assert scalar(db, "SELECT COUNT(*) FROM academy_course_assignments WHERE tenant_id=? AND status IN ('assigned','in_progress')", (tenant,)) == 1
    assert scalar(db, "SELECT COUNT(*) FROM academy_event_registrations WHERE tenant_id=? AND status='waitlisted'", (tenant,)) == 1
    assert scalar(db, "SELECT COUNT(*) FROM academy_events WHERE tenant_id=? AND smart_farm_experience=1", (tenant,)) == 1
    assert scalar(db, "SELECT COUNT(*) FROM academy_instructor_qualifications WHERE tenant_id=? AND verification_status='verified'", (tenant,)) == 1
    assert scalar(db, "SELECT COUNT(*) FROM academy_course_instructor_roles WHERE tenant_id=? AND role='technical_responsible' AND status='active'", (tenant,)) == 1

    other_tenant_count = scalar(db, "SELECT COUNT(*) FROM academy_courses WHERE tenant_id='TENANT-OTHER'")
    assert other_tenant_count == 0

    violations = db.execute('PRAGMA foreign_key_check').fetchall()
    assert not violations, violations
    print('PASS integration_reports_contract: academic, enterprise, events and technical governance metrics')
    db.close()


if __name__ == '__main__':
    main()
