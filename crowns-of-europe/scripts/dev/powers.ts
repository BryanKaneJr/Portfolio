/**
 * Dev tool: follow some crowns through AI-only games and see who takes their land.
 * npx tsx scripts/dev/powers.ts [years] [TAG,TAG...] [seeds...]
 * Prints every war that costs a followed crown land (sides, and who got which region), unions and deaths, and
 * at milestone years the size (regions/troops' age) of the great powers.
 */
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { ownedRegions } from '../../src/sim/queries';
import { yearOf } from '../../src/sim/util';
import type { GameState, NationId } from '../../src/sim/types';

const years = Number(process.argv[2] ?? 100);
const followed = (process.argv[3] ?? 'FRA,HAB').split(',');
const seeds = process.argv.slice(4).map(Number);
const MILESTONES = new Set([1480, 1520, 1550, 1600, 1650, 1700, 1750]);
const POWERS = ['FRA', 'HAB', 'ENG', 'CAS', 'ARA', 'POR', 'BUR', 'HUN', 'BOH', 'POL', 'VEN', 'MLO', 'TUR', 'MOS', 'DAN', 'SWE', 'BRA'];

const held = (s: GameState, n: NationId) => new Set(ownedRegions(s, n).map(r => r.id));

for (const seed of seeds.length ? seeds : [1, 2, 3, 4]) {
  const s = newGame({ player: 'POR', seed });
  s.flags.__spectate = 1; // the AI plays everyone
  console.log(`seed ${seed}`);
  const atStart = new Map<string, Map<NationId, Set<string>>>(); // war id → followed crown → regions held when it joined
  const overlord = new Map<NationId, string | undefined>(followed.map(n => [n, s.nations[n]?.overlord]));
  const alive = new Map<NationId, boolean>(followed.map(n => [n, !!s.nations[n]?.alive]));
  for (let d = 0; d < years * 365; d++) {
    advanceDay(s);
    const y = yearOf(s.day);
    for (const w of Object.values(s.wars)) {
      let m = atStart.get(w.id);
      if (!m) atStart.set(w.id, (m = new Map()));
      for (const n of followed) if (!m.has(n) && (w.attackers.includes(n) || w.defenders.includes(n))) m.set(n, held(s, n));
    }
    for (const [id, m] of atStart) {
      if (s.wars[id]) continue;
      for (const [n, before] of m) {
        const now = held(s, n);
        const lost = [...before].filter(r => !now.has(r));
        if (lost.length) console.log(`  ${y} ${n} loses ${lost.map(r => `${r}→${s.regions[r].owner}`).join(' ')} (${before.size}→${now.size})`);
      }
      atStart.delete(id);
    }
    for (const n of followed) {
      const nat = s.nations[n];
      if (nat.overlord !== overlord.get(n)) {
        console.log(`  ${y} ${n} ${nat.overlord ? `becomes a ${nat.subjectType} subject of ${nat.overlord}` : 'is free again'}`);
        overlord.set(n, nat.overlord);
      }
      if (nat.alive !== alive.get(n)) {
        console.log(`  ${y} ${n} ${nat.alive ? 'returns' : `is gone (capital ${nat.capital} held by ${s.regions[nat.capital]?.owner})`}`);
        alive.set(n, nat.alive);
      }
    }
    if (d % 365 === 364 && MILESTONES.has(y)) {
      // Regions, and the troops' age after a slash.
      console.log(`  ${y}: ${POWERS.map(n => `${n} ${s.nations[n]?.alive ? `${ownedRegions(s, n).length}/${s.nations[n].era}` : '-'}`).join(' ')}`);
    }
  }
}
