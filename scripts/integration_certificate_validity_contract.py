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

    tenant = 'TENANT-VALIDITY'
    now = '2026-09-02T18:00:00.000Z'
    completed = '2026-01-31T12:00:00.000Z'

    db.execute(
        '''INSERT INTO academy_courses (
          id, tenant_id, title, status, quiz_enabled, minimum_score, attempts_allowed,
          created_by, updated_by, created_at, updated_at, instructor_label, certificate_type
        ) VALUES ('COURSE-V', ?, 'Treinamento Regulatório Teste', 'published', 0, 0, 1,
          'admin', 'admin', ?, ?, 'Responsável Teste', 'regulatory_training')''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_enrollments (
          id, tenant_id, course_id, student_id, student_name_snapshot,
          source, status, enrolled_at, completed_at, updated_at, active_cycle_id
        ) VALUES ('ENROLL-V', ?, 'COURSE-V', 'STUDENT-V', 'Aluno Validade',
          'academy', 'completed', ?, ?, ?, 'CYCLE-V1')''',
        (tenant, completed, completed, completed),
    )
    db.execute(
        '''INSERT INTO academy_learning_cycles (
          id, tenant_id, enrollment_id, student_id, course_id, cycle_number,
          status, source, started_at, completed_at, created_at, updated_at
        ) VALUES ('CYCLE-V1', ?, 'ENROLL-V', 'STUDENT-V', 'COURSE-V', 1,
          'completed', 'academy', ?, ?, ?, ?)''',
        (tenant, completed, completed, completed, completed),
    )

    # Política v1: 12 meses, confirmada e versionada.
    db.execute(
        '''INSERT INTO academy_certificate_validity_policies (
          id, tenant_id, course_id, validity_mode, validity_months,
          source_reference, note, version, confirmed_by, confirmed_at, updated_at
        ) VALUES ('POLICY-V', ?, 'COURSE-V', 'fixed_months', 12,
          'Procedimento técnico aprovado', 'Prazo validado para este treinamento', 1,
          'ADMIN-V', ?, ?)''',
        (tenant, now, now),
    )
    db.execute(
        '''INSERT INTO academy_certificate_validity_policy_versions (
          id, tenant_id, course_id, version, validity_mode, validity_months,
          source_reference, note, confirmed_by, confirmed_at, created_at
        ) VALUES ('POLICY-V1', ?, 'COURSE-V', 1, 'fixed_months', 12,
          'Procedimento técnico aprovado', 'Prazo validado para este treinamento',
          'ADMIN-V', ?, ?)''',
        (tenant, now, now),
    )

    # Certificado congela a política v1. 31/01/2026 + 12 meses = 31/01/2027.
    db.execute(
        '''INSERT INTO academy_certificates (
          id, cycle_id, public_code, student_id, student_name, course_id, course_title,
          issued_at, status, tenant_id, workload_minutes, instructor_label,
          certificate_type, completion_date, metadata_version,
          validity_mode, validity_policy_version, valid_until, validity_policy_snapshot_json
        ) VALUES ('CERT-V1','CYCLE-V1','IFA-VALIDITY-V1','STUDENT-V','Aluno Validade',
          'COURSE-V','Treinamento Regulatório Teste',?,'valid',?,60,'Responsável Teste',
          'regulatory_training',?,2,'fixed_months',1,'2027-01-31T12:00:00.000Z',
          '{"version":1,"mode":"fixed_months","validityMonths":12}')''',
        (now, tenant, completed),
    )

    # A política futura muda para 24 meses e ganha v2.
    db.execute(
        '''UPDATE academy_certificate_validity_policies
           SET validity_months=24, version=2, note='Nova decisão para emissões futuras',
               confirmed_at=?, updated_at=?
           WHERE tenant_id=? AND course_id='COURSE-V' ''',
        (now, now, tenant),
    )
    db.execute(
        '''INSERT INTO academy_certificate_validity_policy_versions (
          id, tenant_id, course_id, version, validity_mode, validity_months,
          source_reference, note, confirmed_by, confirmed_at, created_at
        ) VALUES ('POLICY-V2', ?, 'COURSE-V', 2, 'fixed_months', 24,
          'Procedimento técnico aprovado', 'Nova decisão para emissões futuras',
          'ADMIN-V', ?, ?)''',
        (tenant, now, now),
    )

    cert = db.execute(
        '''SELECT validity_mode, validity_policy_version, valid_until, validity_policy_snapshot_json
           FROM academy_certificates WHERE id='CERT-V1' '''
    ).fetchone()
    assert cert['validity_mode'] == 'fixed_months'
    assert cert['validity_policy_version'] == 1
    assert cert['valid_until'] == '2027-01-31T12:00:00.000Z'
    assert '"version":1' in cert['validity_policy_snapshot_json']

    policy = db.execute(
        '''SELECT version, validity_months FROM academy_certificate_validity_policies
           WHERE tenant_id=? AND course_id='COURSE-V' ''',
        (tenant,),
    ).fetchone()
    assert (policy['version'], policy['validity_months']) == (2, 24)
    assert db.execute(
        '''SELECT COUNT(*) FROM academy_certificate_validity_policy_versions
           WHERE tenant_id=? AND course_id='COURSE-V' ''',
        (tenant,),
    ).fetchone()[0] == 2

    # Certificado legado/não configurado é permitido e nunca significa validade indefinida.
    db.execute(
        '''INSERT INTO academy_learning_cycles (
          id, tenant_id, enrollment_id, student_id, course_id, cycle_number,
          status, source, started_at, completed_at, created_at, updated_at
        ) VALUES ('CYCLE-V2', ?, 'ENROLL-V', 'STUDENT-V', 'COURSE-V', 2,
          'completed', 'legacy_test', ?, ?, ?, ?)''',
        (tenant, now, now, now, now),
    )
    db.execute(
        '''INSERT INTO academy_certificates (
          id, cycle_id, public_code, student_id, student_name, course_id, course_title,
          issued_at, status, tenant_id, workload_minutes, instructor_label,
          certificate_type, completion_date, metadata_version
        ) VALUES ('CERT-LEGACY','CYCLE-V2','IFA-VALIDITY-LEGACY','STUDENT-V','Aluno Validade',
          'COURSE-V','Treinamento Regulatório Teste',?,'valid',?,60,'Responsável Teste',
          'regulatory_training',?,1)''',
        (now, tenant, now),
    )
    legacy = db.execute(
        "SELECT validity_mode, validity_policy_version, valid_until FROM academy_certificates WHERE id='CERT-LEGACY'"
    ).fetchone()
    assert legacy['validity_mode'] == 'not_configured'
    assert legacy['validity_policy_version'] is None
    assert legacy['valid_until'] is None

    # Banco rejeita políticas cross-tenant e combinações semânticas inválidas.
    expect_integrity(
        db,
        '''INSERT INTO academy_certificate_validity_policies (
          id, tenant_id, course_id, validity_mode, validity_months,
          source_reference, note, version, confirmed_by, confirmed_at, updated_at
        ) VALUES (?, ?, 'COURSE-V', 'fixed_months', 12, 'Fonte', 'Nota válida', 1, 'A', ?, ?)''',
        ('POLICY-CROSS', 'TENANT-OTHER', now, now),
        'academy_certificate_validity_policies tenant/course mismatch',
    )
    expect_integrity(
        db,
        '''UPDATE academy_certificate_validity_policies
           SET validity_mode='indefinite', validity_months=24
           WHERE tenant_id=? AND course_id='COURSE-V' ''',
        (tenant,),
        'indefinite validity must not define validity_months',
    )

    violations = db.execute('PRAGMA foreign_key_check').fetchall()
    assert not violations, violations
    print('PASS integration_certificate_validity_contract: policy history, immutable snapshots and tenant isolation')
    db.close()


if __name__ == '__main__':
    main()
