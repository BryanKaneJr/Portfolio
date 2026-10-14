/**
 * Dev tool: how the AI makes war over a whole AI-only game. npx tsx scripts/dev/aiwars.ts [years] [seeds...]
 * Prints, per seed: wars declared per decade (by reason), battles the attacker lost, wars that ran into the 20-year
 * cap, the share of AI armies of 10+ regiments with a general at milestone years, and the great powers' size at the
 * end; then wars by origin (who started them), the top 10 attackers, wars in the first two years, wars between members
 * of the Empire, holy wars, the median years between two wars of the same pair, and the truces' lengths. The
 * spectated player answers peace offers as the AI would (otherwise nobody does, and its wars never end).
 */
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { answerOffer } from '../../src/sim/commands';
import { armyRegs, ownedRegions } from '../../src/sim/queries';
import { peaceAcceptance } from '../../src/sim/war';
import { isHreMember } from '../../src/sim/diplomacy';
import { DAYS_PER_YEAR, dateOf, pairKey, yearOf, years } from '../../src/sim/util';
import type { NationId } from '../../src/sim/types';

const span = Number(process.argv[2] ?? 256);
const seeds = process.argv.slice(3).map(Number);
const MILESTONES = new Set([1460, 1500, 1550, 1600, 1650, 1700]);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const v = [...xs].sort((a, b) => a - b);
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
};
const count = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);

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
  const start = s.day;
  const origins = new Map<string, number>();
  const attackers = new Map<NationId, number>();
  const pairs = new Map<string, number[]>();
  const truceYears = new Map<number, number>();
  const truceSeen: Record<string, number> = { ...s.truces };
  let early = 0;
  let empire = 0;
  let holy = 0;
  let total = 0;
  for (let d = 0; d < Math.round(span * 365.25); d++) {
    advanceDay(s);
    for (const o of [...s.offers]) if (o.kind === 'peace') answerOffer(s, o.id, !!s.wars[o.war] && peaceAcceptance(s, s.wars[o.war], o.terms, s.player).accept);
    for (const w of Object.values(s.wars)) {
      if (wars.has(w.id)) continue;
      wars.set(w.id, { started: w.started, player: w.attackers[0] === s.player || w.defenders[0] === s.player });
      total++;
      count(origins, w.origin ?? (w.cb === 'coalition' || w.cb === 'independence' ? w.cb : 'unknown'));
      count(attackers, w.attackers[0]);
      const pair = pairKey(w.attackers[0], w.defenders[0]);
      pairs.set(pair, [...(pairs.get(pair) ?? []), w.started]);
      if (w.started - start < 730) early++;
      if (isHreMember(s, w.attackers[0]) && isHreMember(s, w.defenders[0])) empire++;
      if (w.cb === 'holy') holy++;
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
    for (const [k, until] of Object.entries(s.truces)) {
      if (truceSeen[k] === until) continue;
      truceSeen[k] = until;
      count(truceYears, Math.round((until - s.day) / DAYS_PER_YEAR));
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
  console.log(`  wars ${total}: ${[...origins].sort((a, b) => b[1] - a[1]).map(([o, n]) => `${o} ${n}`).join(', ')}; in the first two years ${early}; between members of the Empire ${empire}; holy ${holy}`);
  console.log(`  top attackers: ${[...attackers].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, k]) => `${n} ${k}`).join(', ')}`);
  const gaps = [...pairs.values()].flatMap(ds => ds.slice(1).map((d, i) => (d - ds[i]) / DAYS_PER_YEAR));
  console.log(`  median years between two wars of the same pair: ${median(gaps).toFixed(1)} (${gaps.length} repeats)`);
  console.log(`  truces (years: count): ${[...truceYears].sort((a, b) => a[0] - b[0]).map(([y, n]) => `${y}: ${n}`).join(', ')}`);
  console.log(`  ${yearOf(s.day)}: ${['FRA', 'HAB', 'ENG', 'CAS', 'TUR', 'POL', 'MOS'].map(n => `${n} ${size(n)}`).join(', ')}; ${Object.values(s.nations).filter(n => n.alive).length} realms`);
}
