import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANALYTICS_EVENTS, REPORT_CATEGORIES } from '@brainscroll/core';

const migrations = join(import.meta.dirname, '..', '..', 'backend', 'supabase', 'migrations');
const sql = readdirSync(migrations).sort().map((f) => readFileSync(join(migrations, f), 'utf8')).join('\n');

/** Replays every migration's inserts into and deletes from the allowlist, in order. */
function serverEventNames(): string[] {
  const names = new Set<string>();
  const statements = /insert into public\.analytics_event_names \(name, description\) values([\s\S]*?);|delete from public\.analytics_event_names where name in \(([^)]*)\);/g;
  for (const m of sql.matchAll(statements)) {
    if (m[1] !== undefined) for (const v of m[1].matchAll(/\('([a-z_]+)',/g)) names.add(v[1]!);
    else for (const v of (m[2] ?? '').matchAll(/'([a-z_]+)'/g)) names.delete(v[1]!);
  }
  return [...names].sort();
}

test('the client event catalog matches the server allowlist', () => {
  assert.deepEqual(serverEventNames(), Object.keys(ANALYTICS_EVENTS).sort());
});

test('report categories match the report_category enum', () => {
  const values = /create type public\.report_category as enum \(([^)]*)\)/.exec(sql)?.[1] ?? '';
  const server = [...values.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(server, REPORT_CATEGORIES.map((c) => c.id).sort());
});
