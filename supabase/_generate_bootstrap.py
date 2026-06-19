#!/usr/bin/env python3
"""Genera supabase/_bootstrap.sql: esquema completo de LexDocs para aplicar de una
vez en un proyecto Supabase NUEVO (vía SQL Editor o psql).

- Concatena schema.sql + migration-001..NNN en orden.
- Quita los INSERT de datos demo de nivel superior (tenants, jurisprudence,
  legislation, users) que dependen de seed.sql / auth.users inexistentes.
- Antepone un reset limpio del schema public (re-ejecutable).
- SIN BEGIN/COMMIT (el editor SQL de Supabase gestiona su propia transacción).
- Añade una verificación al final (nº de tablas y cobertura RLS).

Uso:  python3 supabase/_generate_bootstrap.py
"""
import glob, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
STRIP_PREFIXES = ('INSERT INTO tenants', 'INSERT INTO jurisprudence',
                  'INSERT INTO legislation', 'INSERT INTO users')

def strip_demo_inserts(text):
    out, skipping = [], False
    for line in text.splitlines(keepends=True):
        if not skipping:
            if any(line.startswith(p) for p in STRIP_PREFIXES):  # solo top-level (sin indentar)
                skipping = not line.rstrip().endswith(';')
                continue
            out.append(line)
        elif line.rstrip().endswith(';'):
            skipping = False
    return ''.join(out)

files = [os.path.join(HERE, 'schema.sql')] + sorted(glob.glob(os.path.join(HERE, 'migration-*.sql')))
body = strip_demo_inserts('\n\n'.join(open(f).read() for f in files))

reset = """-- ── Reset limpio del schema public (proyecto NUEVO, sin datos reales) ──
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

"""

verify = """

-- ── VERIFICACIÓN (el editor muestra el resultado de esta última consulta) ──
select
  (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tablas,
  (select count(*) from pg_tables where schemaname='public' and rowsecurity) as con_rls,
  (select count(*) from pg_tables where schemaname='public' and not rowsecurity) as sin_rls;
"""

out = reset + body.strip() + '\n' + verify
open(os.path.join(HERE, '_bootstrap.sql'), 'w').write(out)
print(f"Generado _bootstrap.sql desde {len(files)} archivos ({len(out.splitlines())} líneas).")
print("Incluidos:", ', '.join(os.path.basename(f) for f in files))
