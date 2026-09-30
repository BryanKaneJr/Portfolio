import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Hosted Supabase runs every API request with pg-safeupdate, which rejects an
 * UPDATE or DELETE that has no WHERE clause. Local Postgres (npm run test:db)
 * has no such guard, so a function can pass every test here and still fail on
 * a real project (import_content did: 20261020000000_import_safe_update.sql).
 * This checks the latest definition of every function for such a statement.
 * A WHERE inside a sub-query doesn't count; ON CONFLICT ... DO UPDATE is fine.
 */
const migrations = join(import.meta.dirname, '..', '..', 'backend', 'supabase', 'migrations');

function latestFunctionBodies(): Map<string, string> {
  const bodies = new Map<string, string>();
  for (const file of readdirSync(migrations).sort()) {
    const sql = readFileSync(join(migrations, file), 'utf8');
    for (const m of sql.matchAll(/create or replace function public\.(\w+)\([^)]*\)[\s\S]*?as \$\$([\s\S]*?)\$\$/gi)) bodies.set(m[1]!, m[2]!);
  }
  return bodies;
}

/** The statement with every parenthesised part removed, so only its own clauses remain. */
function topLevel(statement: string): string {
  let depth = 0;
  let out = '';
  for (const ch of statement) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0) out += ch;
  }
  return out;
}

export function unguardedStatements(body: string): string[] {
  const code = body.replace(/--[^\n]*/g, '');
  const found: string[] = [];
  for (const m of code.matchAll(/\b(update|delete\s+from)\s+(public\.)?\w+/gi)) {
    // "on conflict (...) do update set ..." belongs to an insert, and "for update" is a row lock.
    if (/\b(do|for)\s*$/i.test(code.slice(Math.max(0, m.index! - 12), m.index!))) continue;
    const end = code.indexOf(';', m.index!);
    const statement = code.slice(m.index!, end < 0 ? undefined : end);
    if (!/\bwhere\b/i.test(topLevel(statement))) found.push(statement.replace(/\s+/g, ' ').slice(0, 120));
  }
  return found;
}

test('no function runs an UPDATE or DELETE without a WHERE clause (pg-safeupdate on hosted Supabase)', () => {
  const offenders = [...latestFunctionBodies()].flatMap(([name, body]) => unguardedStatements(body).map((s) => `${name}: ${s}`));
  assert.deepEqual(offenders, []);
});

test('the check catches an unqualified UPDATE and ignores safe ones', () => {
  assert.equal(unguardedStatements('update public.skills s set x = (select 1 from t where t.a = s.a);').length, 1);
  assert.equal(unguardedStatements('delete from public.t;').length, 1);
  assert.equal(unguardedStatements('update public.t set x = 1 where id = 2;').length, 0);
  assert.equal(unguardedStatements('insert into public.t values (1) on conflict (id) do update set x = 1;').length, 0);
  assert.equal(unguardedStatements('select * from public.t a where a.id = 1 for update of a;').length, 0);
});
