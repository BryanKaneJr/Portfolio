/**
 * Dev tool: how the AI makes war over a whole AI-only game. npx tsx scripts/dev/aiwars.ts [years] [seeds...]
 * Prints, per seed: wars declared per decade (by reason), battles the attacker lost, wars that ran into the 20-year
 * cap, the share of AI armies of 10+ regiments with a general at milestone years, and the great powers' size at the
 * end. The spectated player answers peace offers as the AI would (otherwise nobody does, and its wars never end).
 */
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { answerOffer } from '../../src/sim/commands';
import { armyRegs, ownedRegions } from '../../src/sim/queries';
import { peaceAcceptance } from '../../src/sim/war';
import { dateOf, yearOf, years } from '../../src/sim/util';
import type { NationId } from '../../src/sim/types';

const span = Number(process.argv[2] ?? 256);
const seeds = process.argv.slice(3).map(Number);
const MILESTONES = new Set([1460, 1500, 1550, 1600, 1650, 1700]);

for (const seed of seeds.length ? seeds : [1, 2, 3]) {
  const s = newGame({ player: 'POR', seed });
  s.flags.__spectate = 1; // the AI plays everyone
  const decades = new Map<number, Map<string, number>>();
  const wars = new Map<string, { started: number; player: boolean }>();
  let ended = 0;
  let capped = 0;
  let cappedPlayer = 0;
  const seenReports = new Set<string>();
  let battles = 0;
  let attackerLost = 0;
  const generals: string[] = [];
  for (let d = 0; d < Math.round(span * 365.25); d++) {
    advanceDay(s);
    for (const o of [...s.offers]) if (o.kind === 'peace') answerOffer(s, o.id, !!s.wars[o.war] && peaceAcceptance(s, s.wars[o.war], o.terms, s.player).accept);
    for (const w of Object.values(s.wars)) {
      if (wars.has(w.id)) continue;
      wars.set(w.id, { started: w.started, player: w.attackers[0] === s.player || w.defenders[0] === s.player });
      const dec = Math.floor(yearOf(w.started) / 10) * 10;
      const m = decades.get(dec) ?? new Map<string, number>();
      m.set(w.cb, (m.get(w.cb) ?? 0) + 1);
      decades.set(dec, m);
    }
    for (const [id, w] of wars) {
      if (s.wars[id]) continue;
      wars.delete(id);
      ended++;
      if (s.day - w.started >= years(20)) {
        capped++;
        if (w.player) cappedPlayer++;
      }
    }
    for (const r of s.reports) {
      if (seenReports.has(r.id) || r.leaders.includes('REB')) continue;
      seenReports.add(r.id);
      battles++;
      if (r.winner === 1) attackerLost++;
    }
    const date = dateOf(s.day);
    if (date.month === 0 && date.day === 2 && MILESTONES.has(date.year)) {
      const big = Object.values(s.armies).filter(a => a.owner !== 'REB' && armyRegs(a) >= 10);
      generals.push(`${date.year} ${Math.round((100 * big.filter(a => a.general).length) / Math.max(1, big.length))}%`);
    }
  }
  console.log(`seed ${seed}`);
  for (const [dec, m] of [...decades].sort((a, b) => a[0] - b[0])) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    console.log(`  ${dec}s ${String(total).padStart(3)}  ${[...m].map(([cb, n]) => `${cb} ${n}`).join(', ')}`);
  }
  console.log(`  battles ${battles}, the attacker lost ${Math.round((100 * attackerLost) / Math.max(1, battles))}%`);
  console.log(`  wars ended ${ended}; ran into the 20-year cap ${capped} (the spectated player leading a side in ${cappedPlayer})`);
  console.log(`  AI armies of 10+ regiments with a general: ${generals.join(', ')}`);
  const size = (n: NationId) => (s.nations[n]?.alive ? `${ownedRegions(s, n).length}${s.nations[n].overlord ? ` (under ${s.nations[n].overlord})` : ''}` : '-');
  console.log(`  ${yearOf(s.day)}: ${['FRA', 'HAB', 'ENG', 'CAS', 'TUR', 'POL', 'MOS'].map(n => `${n} ${size(n)}`).join(', ')}; ${Object.values(s.nations).filter(n => n.alive).length} realms`);
}
