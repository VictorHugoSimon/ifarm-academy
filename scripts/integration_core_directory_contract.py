from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / 'migrations').glob('*.sql'))


def main() -> None:
    db = sqlite3.connect(':memory:')
    db.execute('PRAGMA foreign_keys = ON')
    for migration in MIGRATIONS:
        db.executescript(migration.read_text(encoding='utf-8'))

    now = '2026-09-08T18:30:00.000Z'
    db.execute(
        """INSERT INTO academy_companies (
          id, tenant_id, name, status, created_by, created_at, updated_at
        ) VALUES ('COMPANY-A','TENANT-A','Empresa A','active','admin',?,?)""",
        (now, now),
    )

    # Registros legados continuam válidos após a migration 0034.
    db.execute(
        """INSERT INTO academy_company_members (
          id, tenant_id, company_id, user_id, display_name_snapshot, status, created_at, updated_at
        ) VALUES ('MEMBER-LEGACY','TENANT-A','COMPANY-A','USER-LEGACY','Legado','active',?,?)""",
        (now, now),
    )
    legacy = db.execute(
        "SELECT core_membership_id FROM academy_company_members WHERE id='MEMBER-LEGACY'"
    ).fetchone()
    assert legacy == (None,)

    # Novos registros podem manter somente a referência da membership Core;
    # e-mail/role continuam fora da tabela Academy.
    db.execute(
        """INSERT INTO academy_company_members (
          id, tenant_id, company_id, core_membership_id, user_id,
          display_name_snapshot, status, created_at, updated_at
        ) VALUES ('MEMBER-CORE','TENANT-A','COMPANY-A','33333333-3333-4333-8333-333333333333',
                  '44444444-4444-4444-8444-444444444444','Pessoa Core','active',?,?)""",
        (now, now),
    )
    row = db.execute(
        "SELECT core_membership_id, user_id, display_name_snapshot FROM academy_company_members WHERE id='MEMBER-CORE'"
    ).fetchone()
    assert row == (
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444',
        'Pessoa Core',
    )

    columns = {row[1] for row in db.execute("PRAGMA table_info('academy_company_members')")}
    assert 'core_membership_id' in columns
    indexes = {row[1] for row in db.execute("PRAGMA index_list('academy_company_members')")}
    assert 'idx_academy_company_members_core_membership' in indexes

    print('PASS core directory membership reference contract')


if __name__ == '__main__':
    main()
