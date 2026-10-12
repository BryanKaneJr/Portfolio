/**
 * Dev tool: the Ottoman opening war over many AI games. npx tsx scripts/dev/opening.ts [firstSeed] [lastSeed] [untilYear]
 * Prints, per seed, who holds Constantinople and how many regions the Ottomans hold at the end.
 */
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { ownedRegions } from '../../src/sim/queries';
import { yearOf } from '../../src/sim/util';

const [first, last, until] = [Number(process.argv[2] ?? 1), Number(process.argv[3] ?? 12), Number(process.argv[4] ?? 1450)];
for (let seed = first; seed <= last; seed++) {
  const s = newGame({ player: 'POR', seed });
  s.flags.__spectate = 1; // the AI plays everyone
  while (yearOf(s.day) < until) advanceDay(s);
  console.log(`seed ${seed}: Constantinople ${s.regions.constantinople.owner}, Ottomans ${s.nations.TUR.alive ? ownedRegions(s, 'TUR').length : 'dead'} regions`);
}
