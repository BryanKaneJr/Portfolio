/**
 * Dev tool: how the Ottomans fare in AI-only games. npx tsx scripts/dev/ottomans.ts [years] [seeds...]
 * Prints every Ottoman war (side, enemies, result, regions before → after) and, at milestone years, their size,
 * army, troops' age and advances next to Europe's, and who holds Constantinople, Hungary, Austria and Cairo.
 */
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { armiesOf, armyRegs, forceLimit, ownedRegions, totalDev } from '../../src/sim/queries';
import { yearOf } from '../../src/sim/util';

const years = Number(process.argv[2] ?? 40);
const seeds = process.argv.slice(3).map(Number);
const MILESTONES = new Set([1453, 1460, 1470, 1480, 1500, 1520, 1550, 1580, 1600, 1620, 1650, 1680, 1700, 1720]);
const EUROPE = ['HAB', 'VEN', 'HUN', 'POL', 'FRA', 'CAS', 'BOH'];

interface Seen {
  name: string;
  sides: string;
  start: number;
  regions: number;
}

for (const seed of seeds.length ? seeds : [1, 2, 3, 4, 5, 6]) {
  const s = newGame({ player: 'POR', seed });
  s.flags.__spectate = 1; // the AI plays everyone
  const tur = () => s.nations.TUR;
  const regions = () => ownedRegions(s, 'TUR').length;
  console.log(`seed ${seed}`);
  let wars = new Map<string, Seen>();
  let record = { won: 0, lost: 0 };
  for (let d = 0; d < years * 365; d++) {
    advanceDay(s);
    const now = new Map<string, Seen>();
    for (const w of Object.values(s.wars)) {
      const att = w.attackers.includes('TUR');
      if (!att && !w.defenders.includes('TUR')) continue;
      const [ours, theirs] = att ? [w.attackers, w.defenders] : [w.defenders, w.attackers];
      const friends = ours.filter(x => x !== 'TUR');
      now.set(w.id, wars.get(w.id) ?? { name: w.name, sides: `${att ? 'ATT' : 'DEF'} vs ${theirs.join(',')}${friends.length ? ` with ${friends.join(',')}` : ''}`, start: yearOf(s.day), regions: regions() });
    }
    for (const [id, w] of wars) {
      if (now.has(id)) continue;
      const r = tur().record;
      const result = r.warsWon > record.won ? 'WON' : r.warsLost > record.lost ? 'LOST' : 'white/left';
      console.log(`  ${w.start}-${yearOf(s.day)} ${w.name} [${w.sides}] ${result} regions ${w.regions}->${regions()}`);
    }
    record = { won: tur().record.warsWon, lost: tur().record.warsLost };
    wars = now;
    const y = yearOf(s.day);
    if (d % 365 === 364 && MILESTONES.has(y)) {
      const regs = armiesOf(s, 'TUR').reduce((t, a) => t + armyRegs(a), 0);
      const europe = EUROPE.filter(n => s.nations[n]?.alive).map(n => `${n}${s.nations[n].era}`).join(' ');
      const owner = (r: string) => s.regions[r]?.owner;
      console.log(
        `  ${y}: alive ${tur().alive} regions ${regions()} dev ${totalDev(s, 'TUR')} regs ${regs}/${forceLimit(s, 'TUR')} era ${tur().era} adv ${tur().advances.length} | Europe ${europe} | const=${owner('constantinople')} hungary=${owner('hungary')} austria=${owner('austria')} cairo=${owner('cairo')} mods ${tur().modifiers.map(m => m.id).join(',')}`,
      );
    }
  }
}
