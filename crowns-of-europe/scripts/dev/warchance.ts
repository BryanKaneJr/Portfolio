/**
 * Dev tool: each AI crown's war chance and what makes it up (ai.ts, `warOdds`; design note 32).
 * npx tsx scripts/dev/warchance.ts [year=1444] [seed=1] [--opening]
 *
 * Prints, for every AI crown, its chance on 1 January of `year` (in 1444: the start, 11 November, nothing simulated;
 * a later year is played out to its first day, which takes a while), and the chance it would have fully rested, with
 * its factors and the neighbour it would fight. With --opening (1444 only) it also models the opening from the start
 * state: the expected wars in the first two years and by 1450, the claims forged, and how often the Ottomans have not
 * declared by 1449, each averaged over the 0-3 year stagger of the first rest (state.ts) and compared with the rule
 * before note 32 (a flat 0.3/0.2/0.1 on the 1st of each month but March, after a fixed rest of 3/3/4/5 years). The
 * model rolls each month on its 15th, from the month after the start, and assumes the start state holds: a rough
 * check (it takes under a second) of a change of a constant before full games.
 */
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { MAX_MONTHLY, REST_FULL, REST_MIN, warOdds, type WarOdds } from '../../src/sim/ai';
import { NATION, isNativeNation } from '../../src/sim/content';
import { ledger } from '../../src/sim/economy';
import type { NationId } from '../../src/sim/types';
import { DAYS_PER_YEAR, clamp, dateOf, dayOf, formatDate, years } from '../../src/sim/util';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const year = Number(args[0] ?? 1444);
const seed = Number(args[1] ?? 1);
const opening = process.argv.includes('--opening');

const s = newGame({ player: 'POR', seed });
s.flags.__spectate = 1; // the AI plays everyone
const start = s.day;
while (s.day < dayOf(year, 0, 1)) advanceDay(s);
// Before the first 1st of the month nothing has recorded a month's income, and the treasury factor would read every
// crown's reserve as 40 gold: use what the first month will record (the ledger), as the first roll will see it.
if (s.day === start) for (const nat of Object.values(s.nations)) if (nat.alive) nat.lastMonthIncome = ledger(s, nat.id).totalIncome;

const pc = (p: number) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
const x2 = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2));

/** The chance it would have with its rest fully over (nothing else changed). */
function rested(n: NationId): WarOdds {
  const ai = s.nations[n].ai;
  const keep = { lastPeace: ai.lastPeace, lastWarDeclared: ai.lastWarDeclared };
  ai.lastPeace = s.day - years(10);
  ai.lastWarDeclared = undefined;
  const o = warOdds(s, n);
  Object.assign(ai, keep);
  return o;
}

interface Row {
  n: NationId;
  now: WarOdds;
  full: WarOdds;
  /** Years since its last war or peace. */
  since: number;
}
const rows: Row[] = [];
for (const nat of Object.values(s.nations)) {
  if (!nat.alive || isNativeNation(nat.id) || nat.overlord) continue;
  const last = Math.max(nat.ai.lastWarDeclared ?? -Infinity, nat.ai.lastPeace ?? -Infinity);
  rows.push({ n: nat.id, now: warOdds(s, nat.id), full: rested(nat.id), since: (s.day - last) / DAYS_PER_YEAR });
}

console.log(`War chance on ${formatDate(s.day)}, seed ${seed} (subjects and New World peoples never declare)`);
for (const { n, now, full, since } of rows.sort((a, b) => b.full.monthly - a.full.monthly)) {
  const def = NATION[n];
  const state =
    now.blocked === 'rest' ? `resting until ${formatDate(now.restUntil!)}` : now.blocked ? now.blocked : now.best ? `${pc(now.monthly)} a month` : 'no neighbour worth a war';
  const head = `${n} ${def.tier} ${def.personality}`.padEnd(28);
  if (!full.best) {
    console.log(`${head} now ${state}; rested: ${full.blocked ?? 'no neighbour worth a war'}`);
    continue;
  }
  const b = full.best;
  console.log(
    `${head} now ${state}; rested ${pc(full.monthly)} a month (${Math.round(full.yearly)}% a year) on ${b.target} (${b.cb.cb}${b.goal ? ` ${b.goal}` : ''}${b.limited ? ', limited' : ''}; might ${b.ratio.toFixed(2)} for ${b.need.toFixed(2)}); since ${since.toFixed(2)} y`,
  );
  console.log(`${''.padEnd(28)} ${full.factors.filter(f => f.key === 'base' || Math.abs(f.x - 1) > 1e-9).map(f => `${f.key} ${x2(f.x)}`).join(' × ')}`);
}

if (opening && year === 1444) {
  // Roll days: the 15th of each month from the month after the start (old rule: the 1st, never in March).
  const newDays: number[] = [];
  const oldDays: number[] = [];
  let { year: y, month: m } = dateOf(start);
  for (let i = 0; i < 80; i++) {
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
    newDays.push(dayOf(y, m, 15));
    if (m !== 2) oldDays.push(dayOf(y, m, 1));
  }
  const OLD_EVAL: Record<string, number> = { expansionist: 0.3, opportunist: 0.2, trader: 0.1, defensive: 0.1 };
  const OLD_REST: Record<string, number> = { expansionist: 3, opportunist: 3, trader: 4, defensive: 5 };
  /** The chance that crown `r` has acted (declared or forged) by `until`, its last peace `x` years before the start. */
  const pNew = (r: Row, x: number, until: number) => {
    const pers = NATION[r.n].personality;
    const target = r.full.yearly / r.full.crown; // the target's factors (its crown factors are fully rested here)
    let survive = 1;
    for (const d of newDays) {
      if (d > until) break;
      const since = x + (d - start) / DAYS_PER_YEAR;
      const rest = clamp((since - REST_MIN) / (REST_FULL[pers] - REST_MIN), 0, 1);
      survive *= 1 - Math.min(MAX_MONTHLY, (r.full.crown * rest * target) / 1200);
    }
    return 1 - survive;
  };
  const pOld = (r: Row, x: number, until: number) => {
    const pers = NATION[r.n].personality;
    let survive = 1;
    for (const d of oldDays) {
      if (d > until) break;
      if (x + (d - start) / DAYS_PER_YEAR < OLD_REST[pers]) continue;
      survive *= 1 - OLD_EVAL[pers];
    }
    return 1 - survive;
  };
  const xs = Array.from({ length: 61 }, (_, i) => i * 0.05); // the first rest begun 0-3 years before the start
  const avg = (f: (x: number) => number) => xs.reduce((t, x) => t + f(x), 0) / xs.length;
  const two = start + 730;
  const by1450 = dayOf(1450, 0, 1);
  const by1449 = dayOf(1449, 0, 1);
  const by1448 = dayOf(1448, 0, 1);
  const sum = { new2: 0, old2: 0, new50: 0, old50: 0, forgeNew2: 0, forgeOld2: 0 };
  console.log('\nOpening model (chance of acting, averaged over the stagger; seed: this seed’s own stagger, by 1448)');
  console.log(`${'crown'.padEnd(6)}${'target'.padEnd(18)}${'2 years'.padStart(12)}${'by 1450'.padStart(12)}${'seed by 1448'.padStart(15)}   (new / old)`);
  for (const r of rows) {
    if (!r.full.best) continue;
    const b = r.full.best;
    const n2 = avg(x => pNew(r, x, two));
    const o2 = avg(x => pOld(r, x, two));
    const n50 = avg(x => pNew(r, x, by1450));
    const o50 = avg(x => pOld(r, x, by1450));
    if (b.cb.cb === 'none') {
      sum.forgeNew2 += n2;
      sum.forgeOld2 += o2;
    } else {
      sum.new2 += n2;
      sum.old2 += o2;
      sum.new50 += n50;
      sum.old50 += o50;
    }
    const x0 = r.since - (s.day - start) / DAYS_PER_YEAR;
    console.log(
      `${r.n.padEnd(6)}${`${b.target} ${b.cb.cb}`.padEnd(18)}${`${n2.toFixed(2)} / ${o2.toFixed(2)}`.padStart(12)}${`${n50.toFixed(2)} / ${o50.toFixed(2)}`.padStart(12)}${`${pNew(r, x0, by1448).toFixed(2)} / ${pOld(r, x0, by1448).toFixed(2)}`.padStart(15)}`,
    );
  }
  console.log(`\nWars in the first two years: ${sum.new2.toFixed(1)} (old rule ${sum.old2.toFixed(1)})`);
  console.log(`Wars by 1450: ${sum.new50.toFixed(1)} (old rule ${sum.old50.toFixed(1)})`);
  console.log(`Claims forged in the first two years: ${sum.forgeNew2.toFixed(1)} (old rule ${sum.forgeOld2.toFixed(1)})`);
  const tur = rows.find(r => r.n === 'TUR');
  if (tur?.full.best) {
    const missNew = xs.map(x => 1 - pNew(tur, x, by1449));
    const missOld = xs.map(x => 1 - pOld(tur, x, by1449));
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    console.log(
      `Ottomans on ${tur.full.best.target} not declared by 1449: ${(100 * mean(missNew)).toFixed(2)}% of games, worst stagger ${(100 * Math.max(...missNew)).toFixed(1)}% (old rule ${(100 * mean(missOld)).toFixed(2)}%, worst ${(100 * Math.max(...missOld)).toFixed(1)}%)`,
    );
  } else console.log('The Ottomans have no target.');
} else if (opening) console.log('\n--opening models the 1444 start only.');
