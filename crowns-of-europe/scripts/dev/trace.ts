/** Dev tool: follow one nation through an AI-only game. npx tsx scripts/dev/trace.ts TAG [years] [seed] */
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { ownedRegions, totalDev, armiesOf, armyRegs, warsOf, forceLimit } from '../../src/sim/queries';
import { ledger, maxManpower } from '../../src/sim/economy';
import { formatDate } from '../../src/sim/util';
const tag = process.argv[2] ?? 'TUR';
const yrs = Number(process.argv[3] ?? 10);
const s = newGame({ player: 'POR', seed: Number(process.argv[4] ?? 1) });
s.player = tag; // log as if we were them, but let the AI play
s.flags.__spectate = 1;
const nat = s.nations[tag];
for (let d = 0; d < yrs * 365; d++) {
  advanceDay(s);
  if (d % 182 === 0) {
    const l = ledger(s, tag);
    console.log(formatDate(s.day), `reg ${ownedRegions(s, tag).length} dev ${totalDev(s, tag)} gold ${Math.round(nat.gold)} bal ${l.balance.toFixed(1)} loans ${nat.loans} regs ${armiesOf(s, tag).reduce((t, a) => t + armyRegs(a), 0)}/${forceLimit(s, tag)} mp ${Math.round(nat.manpower)}/${maxManpower(s, tag)} stab ${nat.stability} we ${nat.warExhaustion.toFixed(1)} wars ${warsOf(s, tag).map(w => w.name).join('; ')} unrest ${ownedRegions(s, tag).map(r => r.unrest.toFixed(0)).join(',')}`);
  }
}
console.log(s.log.slice(0, 60).reverse().map(l => formatDate(l.day) + ' ' + l.text).join('\n'));
