import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOOST, CHEST, CHEST_LOOT, COSMETICS, TIER_MIN_KNOWLEDGE_LEVEL } from '@brainscroll/core';

/**
 * Chests roll on the server (open_chest) and in core (local play). The
 * cosmetic_items seed, the loot defaults and the tier minimums in
 * 20261106000000_rewards.sql (with later inserts and renames) must match core rewards.ts.
 */
const dir = join(import.meta.dirname, '..', '..', 'backend', 'supabase', 'migrations');
const sql = readFileSync(join(dir, '20261106000000_rewards.sql'), 'utf8');
/** `update public.cosmetic_items set name = ... where id = ...` in migrations after the seed. */
const later = readdirSync(dir)
  .filter((f) => f > '20261106000000_rewards.sql')
  .sort()
  .map((f) => readFileSync(join(dir, f), 'utf8'));
const renames = later.flatMap((s) => [...s.matchAll(/update public\.cosmetic_items set name = '([^']+)' where id = '([^']+)';/g)].map((m) => [m[2]!, m[1]!] as const));
const ROW = /\('([^']+)', '([^']+)', '([^']+)', '([^']+)'\)/g;

test('the cosmetic_items seed matches core COSMETICS', () => {
  const seed = sql.match(/insert into public\.cosmetic_items \(id, kind, tier, name\) values([^;]*);/)![1]!;
  const added = later.flatMap((s) => [...s.matchAll(/insert into public\.cosmetic_items \(id, kind, tier, name\) values([^;]*);/g)].map((m) => m[1]!));
  const name = new Map(renames);
  const rows = [seed, ...added].flatMap((v) => [...v.matchAll(ROW)]).map((m) => `${m[1]}|${m[2]}|${m[3]}|${name.get(m[1]!) ?? m[4]}`);
  assert.deepEqual(rows.sort(), COSMETICS.map((c) => `${c.id}|${c.kind}|${c.tier}|${c.name}`).sort());
});

test('the loot defaults and settings match core', () => {
  const loot = JSON.parse(sql.match(/add column chest_loot jsonb not null default\s*'([^']+)'/)![1]!);
  assert.deepEqual(loot, CHEST_LOOT);
  assert.equal(Number(sql.match(/chest_level_in_chapter int not null default (\d+)/)![1]), CHEST.LEVEL_IN_CHAPTER);
  assert.equal(Number(sql.match(/chest_brainpower int not null default (\d+)/)![1]), CHEST.BRAINPOWER);
  assert.equal(Number(sql.match(/boost_percent int not null default (\d+)/)![1]), BOOST.PERCENT);
});

test('the tier minimums match core', () => {
  const body = sql.match(/select case p_tier ([^\n]*) end/)![1]!;
  const sqlMins = Object.fromEntries([...body.matchAll(/when '(\w+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])]));
  assert.deepEqual(sqlMins, TIER_MIN_KNOWLEDGE_LEVEL);
});
