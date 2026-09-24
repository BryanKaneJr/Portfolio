import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANALYTICS_EVENTS, REPORT_CATEGORIES } from '@brainscroll/core';

const migrations = join(import.meta.dirname, '..', '..', 'backend', 'supabase', 'migrations');
const sql = readdirSync(migrations).sort().map((f) => readFileSync(join(migrations, f), 'utf8')).join('\n');

test('the client event catalog matches the server allowlist', () => {
  const block = /insert into public\.analytics_event_names \(name, description\) values([\s\S]*?);/.exec(sql)?.[1] ?? '';
  const server = [...block.matchAll(/\('([a-z_]+)',/g)].map((m) => m[1]).sort();
  assert.deepEqual(server, Object.keys(ANALYTICS_EVENTS).sort());
});

test('report categories match the report_category enum', () => {
  const values = /create type public\.report_category as enum \(([^)]*)\)/.exec(sql)?.[1] ?? '';
  const server = [...values.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(server, REPORT_CATEGORIES.map((c) => c.id).sort());
});
