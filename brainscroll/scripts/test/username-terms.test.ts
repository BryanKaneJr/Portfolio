import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { USERNAME_ALLOWED, USERNAME_ANYWHERE, USERNAME_PHRASES, USERNAME_RESERVED, USERNAME_WORD } from '@brainscroll/core';

/**
 * The username filter runs twice: on the server (username_terms, seeded by
 * 20261026000000_username_filter.sql and changed by later migrations) and in
 * core (local play and the instant check in Edit profile). Their term lists
 * must be the same. Migrations are replayed in order: each
 * `delete from public.username_terms where term in (...)` and
 * `insert into public.username_terms (term, kind) values (...)`.
 */
test('the username_terms table matches core usernameFilter', () => {
  const dir = join(import.meta.dirname, '..', '..', 'backend', 'supabase', 'migrations');
  const terms = new Map<string, string>();
  for (const file of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, file), 'utf8');
    for (const m of sql.matchAll(/(delete from public\.username_terms where term in \(([^)]*)\))|(insert into public\.username_terms \(term, kind\) values([^;]*);)/g)) {
      if (m[1]) for (const t of m[2]!.matchAll(/'([a-z]+)'/g)) terms.delete(t[1]!);
      else for (const r of m[4]!.matchAll(/\('([a-z]+)', '([a-z]+)'\)/g)) terms.set(r[1]!, r[2]!);
    }
  }
  const rows = [...terms].map(([term, kind]) => `${kind}:${term}`).sort();
  const core = [
    ...USERNAME_RESERVED.map((t) => `reserved:${t}`),
    ...USERNAME_ANYWHERE.map((t) => `anywhere:${t}`),
    ...USERNAME_WORD.map((t) => `word:${t}`),
    ...USERNAME_ALLOWED.map((t) => `allowed:${t}`),
    ...USERNAME_PHRASES.map((t) => `phrase:${t}`),
  ].sort();
  assert.deepEqual(rows, core);
});
