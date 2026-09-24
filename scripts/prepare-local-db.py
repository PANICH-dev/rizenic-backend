#!/usr/bin/env python3
"""Prepare a private PostgreSQL bootstrap from the legacy INSERT-only ZIP.

Does not connect to any database or execute SQL from the archive. Parses and
re-encodes only INSERT values, checks columns against our compatibility schema,
and leaves existing local setup files untouched.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import zipfile

ROOT = Path(__file__).resolve().parents[1]
HEADER = re.compile(
    r'insert\s+into\s+"(\w+)"\s*\(([^)]+)\)\s*'
    r'overriding\s+system\s+value\s+values\s*', re.I
)


def read_values(text, pos):
    if pos >= len(text) or text[pos] != '(':
        raise ValueError('Expected VALUES tuple')
    pos += 1
    values = []
    while pos < len(text):
        while text[pos].isspace():
            pos += 1
        if text[pos] == "'":
            pos += 1
            chunks = []
            while True:
                end = text.index("'", pos)
                chunks.append(text[pos:end])
                pos = end + 1
                if pos < len(text) and text[pos] == "'":
                    chunks.append("'")
                    pos += 1
                else:
                    break
            value = ''.join(chunks)
        else:
            end = pos
            while end < len(text) and text[end] not in ',)':
                end += 1
            token = text[pos:end].strip()
            if token.lower() == 'null':
                value = None
            elif re.fullmatch(r'[+-]?\d+(?:\.\d+)?|true|false', token, re.I):
                value = token
            else:
                raise ValueError('Unsupported unquoted SQL value')
            pos = end
        values.append(value)
        while pos < len(text) and text[pos].isspace():
            pos += 1
        if pos < len(text) and text[pos] == ')':
            return values, pos + 1
        if pos >= len(text) or text[pos] != ',':
            raise ValueError('Expected value separator')
        pos += 1
    raise ValueError('Unterminated VALUES tuple')


def literal(value):
    return 'NULL' if value is None else "'" + value.replace("'", "''") + "'"


def private_write(path, text):
    with open(path, 'x', encoding='utf-8') as stream:
        os.chmod(path, 0o600)
        stream.write(text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', nargs='?', type=Path,
                        default=Path.home() / 'Downloads' / 'Database.zip')
    args = parser.parse_args()
    local = ROOT / '.local'
    env = ROOT / '.env.local'
    if local.exists() or env.exists():
        raise SystemExit('Local setup already exists; refusing to overwrite credentials or bootstrap data.')

    schema = (ROOT / 'infrastructure/local/schema.sql').read_text()
    tables = {}
    identities = {}
    for match in re.finditer(r'CREATE TABLE "(\w+)" \((.*?)\n\);', schema, re.S):
        table, body = match.groups()
        tables[table] = re.findall(r'^    "(\w+)" ', body, re.M)
        identity = re.search(r'^    "(\w+)" integer GENERATED', body, re.M)
        if identity:
            identities[table] = identity[1]

    statements = ['BEGIN;', 'SET LOCAL search_path TO rizenic_old;', 'SET standard_conforming_strings = on;']
    counts = {}
    skipped = []
    with zipfile.ZipFile(args.archive.expanduser()) as archive:
        for name in archive.namelist():
            if not name.endswith('.sql'):
                continue
            text = archive.read(name).decode('utf-8-sig')
            if not text.strip():
                skipped.append(Path(name).name)
                continue
            table = Path(name).stem
            if table not in tables or table in counts:
                raise ValueError(f'Unknown or duplicated table export: {table}')
            pos = 0
            counts[table] = 0
            while pos < len(text):
                while pos < len(text) and text[pos].isspace():
                    pos += 1
                if pos == len(text):
                    break
                match = HEADER.match(text, pos)
                if not match or match[1] != table:
                    raise ValueError(f'Unsupported SQL in {table}; no output was written')
                columns = re.findall(r'"(\w+)"', match[2])
                if columns != tables[table]:
                    raise ValueError(f'Column mismatch for {table}')
                values, pos = read_values(text, match.end())
                if len(values) != len(columns):
                    raise ValueError(f'Value count mismatch for {table}')
                while pos < len(text) and text[pos].isspace():
                    pos += 1
                if pos >= len(text) or text[pos] != ';':
                    raise ValueError(f'Expected statement terminator in {table}')
                pos += 1
                names = ', '.join('"' + col + '"' for col in columns)
                statements.append(f'INSERT INTO "{table}" ({names}) VALUES (' +
                                  ', '.join(map(literal, values)) + ');')
                counts[table] += 1

    if set(counts) != set(tables):
        raise ValueError('Archive is missing expected populated table exports')

    # Explicit IDs from a data-only export do not advance identity sequences.
    for table, column in identities.items():
        statements.append(
            f"SELECT setval(pg_get_serial_sequence('{table}', '{column}'), "
            f'COALESCE(MAX("{column}"), 1), MAX("{column}") IS NOT NULL) FROM "{table}";'
        )

    password = secrets.token_urlsafe(18)
    pages = 'index,jobs,jobs_table,parts,repair,repair_board,repair_export,repair_date_update,finance,dashboard,audit,admin,history'
    for branch, username in [('Navamin', 'local-navamin'), ('Rangsit', 'local-rangsit')]:
        vals = [username, 'Local Admin ' + branch, 'Admin', branch, username, password, pages]
        statements.append(
            'INSERT INTO rizenicemployeemaster '
            '(employee_code, employee_name, employee_role, branch_name, username, password, accessible_pages) '
            'VALUES (' + ', '.join(map(literal, vals)) + ');'
        )
    statements.append('COMMIT;')

    local.mkdir(mode=0o700)
    init = local / 'postgres-init'
    # The host parent remains 0700. The mounted child must be readable by the
    # postgres container user, whose UID differs from the host user's UID.
    init.mkdir(mode=0o755)
    private_write(init / '00-schema.sql', schema)
    private_write(init / '10-data.sql', '\n'.join(statements) + '\n')
    for file in init.iterdir():
        file.chmod(0o644)
    private_write(env, f'LOCAL_DB_PASSWORD={secrets.token_urlsafe(24)}\nLOCAL_DB_PORT=55432\nLOCAL_APP_PORT=3000\n')
    private_write(local / 'login.txt',
                  'Local-only accounts (original employee records are unchanged):\n'
                  f'Navamin username: local-navamin\nRangsit username: local-rangsit\nPassword: {password}\n')
    manifest = {
        'archive_sha256': hashlib.sha256(args.archive.expanduser().read_bytes()).hexdigest(),
        'source_row_counts': counts,
        'local_accounts_added': 2,
        'empty_exports_not_reconstructed': skipped,
    }
    private_write(local / 'import-manifest.json', json.dumps(manifest, indent=2) + '\n')
    print(f'Prepared {len(counts)} tables, {sum(counts.values())} source rows, plus 2 local-only logins.')
    print('Private files: .local/ and .env.local (gitignored).')
    print('Start: docker compose --env-file .env.local -f compose.local.yaml up -d --build')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, IndexError, UnicodeError, zipfile.BadZipFile) as error:
        raise SystemExit(f'Invalid archive: {error}') from None
