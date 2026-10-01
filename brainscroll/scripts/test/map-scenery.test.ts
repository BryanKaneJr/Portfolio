import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickScenery, SCENERY_WINDOW, skillScenery } from '@brainscroll/core';

/**
 * The skill map's floating pictures (core scenery.ts) never repeat within
 * three chapters on any tree, using the real levels and card pictures, as the
 * app picks them (app/src/content/scenery.ts).
 */
const root = join(import.meta.dirname, '..', '..');
const cardArt = JSON.parse(readFileSync(join(root, 'content', 'card-art.json'), 'utf8')) as Record<string, string>;
const byLevel = new Map<string, string[]>();
for (const [cardId, art] of Object.entries(cardArt)) {
  const [, slug, num] = cardId.split('.');
  byLevel.set(`${slug}:${Number(num)}`, [...(byLevel.get(`${slug}:${Number(num)}`) ?? []), art]);
}

test('no tree repeats a map picture within three chapters', () => {
  const skillsDir = join(root, 'content', 'skills');
  const problems: string[] = [];
  for (const dir of readdirSync(skillsDir)) {
    let files: string[] = [];
    try {
      files = readdirSync(join(skillsDir, dir, 'levels')).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }
    const levels = files.map((f) => JSON.parse(readFileSync(join(skillsDir, dir, 'levels', f), 'utf8')) as { number: number; art?: string; id: string });
    const slug = levels[0]!.id.split('.')[2]!; // level.science.astronomy.004 → astronomy, as card ids use
    const map = skillScenery(levels, (n) => byLevel.get(`${slug}:${n}`) ?? []);
    const spots = [...map].sort((a, b) => a[0] - b[0]);
    spots.forEach(([n, art], i) => {
      for (const [m, other] of spots.slice(Math.max(0, i - SCENERY_WINDOW + 1), i)) if (other === art) problems.push(`${dir}: ${art} at levels ${m} and ${n}`);
    });
    // Every spot that has a level image somewhere in its chapter gets a picture.
    const empty = [...Array(Math.ceil(levels.length / 10)).keys()].flatMap((c) => [c * 10 + 3, c * 10 + 7]).filter((n) => n <= levels.length && !map.has(n));
    if (empty.length) problems.push(`${dir}: no picture beside levels ${empty.join(', ')}`);
  }
  assert.deepEqual(problems, []);
});

test('picks a fresh image, then one not seen recently, else nothing', () => {
  assert.deepEqual(pickScenery([['a'], ['a', 'b'], ['a']], 2), ['a', 'b', 'a']);
  assert.deepEqual(pickScenery([['a'], ['a']], 2), ['a', undefined]);
});
