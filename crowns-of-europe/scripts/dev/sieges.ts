/**
 * Dev tool: how long fort sieges take in an AI-only game, and how often they end by storming the walls.
 * npx tsx scripts/dev/sieges.ts [years] [seeds...]
 * Watches every region's siege day by day and records each fort siege that ends with the fort taken: its level,
 * the days from the siege's start to the fall, and whether a storm took it. Prints, per seed, the count and the mean
 * and median days per fort level, then siege.ts's dev counters (storms tried, won, men lost) where the build has them.
 */
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { answerOffer } from '../../src/sim/commands';
import { peaceAcceptance } from '../../src/sim/war';
import * as siege from '../../src/sim/siege';
import { yearOf } from '../../src/sim/util';

const span = Number(process.argv[2] ?? 56);
const seeds = process.argv.slice(3).map(Number);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const v = [...xs].sort((a, b) => a - b);
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

// The storm counters exist only once storming is in the build (the script also runs on the baseline).
type Counts = { tried: number; won: number; men: number; wonAt: Record<string, number> };
const counts = (): Counts | undefined => (siege as unknown as { COUNTS?: Counts }).COUNTS;

for (const seed of seeds.length ? seeds : [1, 2]) {
  const c = counts();
  if (c) {
    c.tried = c.won = c.men = 0;
    c.wonAt = {};
  }
  const s = newGame({ player: 'POR', seed });
  s.flags.__spectate = 1;
  const t0 = Date.now();
  // What each region's siege looked like at the end of the day before.
  const watch = new Map<string, { by: string; started: number; fort: number; controller: string | null }>();
  const falls: { fort: number; days: number; stormed: boolean }[] = [];
  for (let d = 0; d < Math.round(span * 365.25); d++) {
    advanceDay(s);
    for (const o of [...s.offers]) if (o.kind === 'peace') answerOffer(s, o.id, !!s.wars[o.war] && peaceAcceptance(s, s.wars[o.war], o.terms, s.player).accept);
    for (const [id, w] of watch) {
      const reg = s.regions[id];
      if (reg.siege && reg.siege.by === w.by && reg.siege.started === w.started) continue;
      watch.delete(id);
      if (reg.controller !== w.controller && !reg.siege) falls.push({ fort: w.fort, days: s.day - w.started, stormed: c?.wonAt[id] === s.day });
    }
    for (const reg of Object.values(s.regions)) {
      if (!reg.siege || reg.fort <= 0 || watch.has(reg.id)) continue;
      watch.set(reg.id, { by: reg.siege.by, started: reg.siege.started, fort: reg.fort, controller: reg.controller });
    }
  }
  console.log(`seed ${seed} to ${yearOf(s.day)} (${((Date.now() - t0) / 1000).toFixed(0)} s): ${falls.length} forts taken, ${falls.filter(f => f.stormed).length} by storm`);
  for (const fort of [...new Set(falls.map(f => f.fort))].sort((a, b) => a - b)) {
    const fs = falls.filter(f => f.fort === fort);
    const days = fs.map(f => f.days);
    console.log(`  fort ${fort}: ${String(fs.length).padStart(4)} taken, mean ${mean(days).toFixed(0)} days, median ${median(days)} days, by storm ${fs.filter(f => f.stormed).length}`);
  }
  if (c) console.log(`  storms tried ${c.tried}, won ${c.won} (${Math.round((100 * c.won) / Math.max(1, c.tried))}%), men lost ${c.men.toLocaleString()}`);
}
