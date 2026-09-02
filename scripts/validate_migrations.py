from pathlib import Path
import sqlite3
import sys

root = Path(__file__).resolve().parents[1]
migrations = sorted((root / 'migrations').glob('*.sql'))
if not migrations:
    raise SystemExit('Nenhuma migration encontrada')

connection = sqlite3.connect(':memory:')
connection.execute('PRAGMA foreign_keys = ON')

try:
    for migration in migrations:
        sql = migration.read_text(encoding='utf-8')
        try:
            connection.executescript(sql)
        except Exception as exc:
            print(f'FAIL {migration.name}: {exc}', file=sys.stderr)
            raise
        print(f'PASS {migration.name}')

    violations = connection.execute('PRAGMA foreign_key_check').fetchall()
    if violations:
        print('Foreign key violations:', violations, file=sys.stderr)
        raise SystemExit(1)

    tables = connection.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE 'academy_%'"
    ).fetchone()[0]
    triggers = connection.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_%'"
    ).fetchone()[0]
    print(f'Migrations válidas: {len(migrations)} | tabelas Academy: {tables} | triggers: {triggers}')
finally:
    connection.close()
