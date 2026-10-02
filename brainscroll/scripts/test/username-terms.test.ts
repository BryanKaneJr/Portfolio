import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { USERNAME_ALLOWED, USERNAME_ANYWHERE, USERNAME_WORD } from '@brainscroll/core';

/**
 * The username filter runs twice: on the server (username_terms, seeded by
 * 20261026000000_username_filter.sql) and in core (local play and the instant
 * check in Edit profile). Their term lists must be the same.
 */
test('the username_terms seed matches core usernameFilter', () => {
  const sql = readFileSync(join(import.meta.dirname, '..', '..', 'backend', 'supabase', 'migrations', '20261026000000_username_filter.sql'), 'utf8');
  const seed = sql.slice(sql.indexOf('insert into public.username_terms'), sql.indexOf(';', sql.indexOf('insert into public.username_terms')));
  const rows = [...seed.matchAll(/\('([a-z]+)', '(anywhere|word|allowed)'\)/g)].map((m) => `${m[2]}:${m[1]}`).sort();
  const core = [
    ...USERNAME_ANYWHERE.map((t) => `anywhere:${t}`),
    ...USERNAME_WORD.map((t) => `word:${t}`),
    ...USERNAME_ALLOWED.map((t) => `allowed:${t}`),
  ].sort();
  assert.deepEqual(rows, core);
});
