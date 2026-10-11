/** Dev tool: simulate N years with the AI playing everyone and print what happened. npx tsx scripts/dev/soak.ts [years] [seed] [player] */
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { NATION } from '../../src/sim/content';
import { ownedRegions, totalDev, armiesOf, armyRegs } from '../../src/sim/queries';
import { coloniesOf, colonistsOf, newWorldRegions } from '../../src/sim/colonies';
import { formatDate } from '../../src/sim/util';

const yearsArg = Number(process.argv[2] ?? 10);
const seed = Number(process.argv[3] ?? 1);
const player = process.argv[4] ?? 'HUN'; // spectated by the AI; avoid colonial powers (their event cards queue up)
const s = newGame({ player, seed });
// Let the AI also run the player's nation for the soak test.
s.flags.__spectate = 1;
const t0 = Date.now();
let wars = 0;
const seenWars = new Set<string>();
const days = Math.round(yearsArg * 365.25);
for (let i = 0; i < days; i++) {
  advanceDay(s);
  for (const id of Object.keys(s.wars)) if (!seenWars.has(id)) { seenWars.add(id); wars++; }
}
const ms = Date.now() - t0;
console.log(`${yearsArg} years in ${ms} ms (${(ms / days).toFixed(2)} ms/day). Now ${formatDate(s.day)}. Wars started: ${wars}, active: ${Object.keys(s.wars).length}`);
const alive = Object.values(s.nations).filter(n => n.alive);
console.log(`alive nations: ${alive.length}/${Object.keys(s.nations).length}; armies ${Object.keys(s.armies).length}; battles fought (reports kept) ${s.reports.length}`);
const top = alive.sort((a, b) => totalDev(s, b.id) - totalDev(s, a.id)).slice(0, 14);
for (const n of top) console.log(`${NATION[n.id].name.padEnd(16)} regions ${String(ownedRegions(s, n.id).length).padStart(3)} dev ${String(totalDev(s, n.id)).padStart(4)} gold ${Math.round(n.gold).toString().padStart(5)} loans ${n.loans} regs ${armiesOf(s, n.id).reduce((t, a) => t + armyRegs(a), 0)} mp ${Math.round(n.manpower)} threat ${Math.round(n.threat)} era ${n.era} stab ${n.stability}`);
console.log(`New World: found ${s.discovery ? `${formatDate(s.discovery.day)} by ${s.discovery.by ?? 'everyone'}` : 'not yet'}; uncolonized ${Object.values(s.regions).filter(r => !r.owner).length}`);
for (const n of alive.filter(x => newWorldRegions(s, x.id).length || coloniesOf(s, x.id).length || colonistsOf(s, x.id)))
  console.log(`  ${NATION[n.id].name.padEnd(16)} New World regions ${newWorldRegions(s, n.id).length}, settling ${coloniesOf(s, n.id).length}/${colonistsOf(s, n.id)} colonists: ${newWorldRegions(s, n.id).map(r => r.id).join(', ')}`);
console.log('coalitions:', s.coalitions.map(c => `${c.target}<-${c.members.join(',')}`).join(' | ') || 'none');
console.log('emperor:', s.hre.emperor);
console.log('recent log:'); for (const l of s.log.slice(0, 25)) console.log('  ', formatDate(l.day), l.text);
