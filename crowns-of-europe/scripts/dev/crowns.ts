/**
 * Dev tool: greater crowns in AI-only games. npx tsx scripts/dev/crowns.ts [years] [seeds...]
 * Prints, per seed, every proclamation (year, realm, crown), and at 1460, 1475 and 1500 the realms alive, Naples'
 * regions and how many of the history events (events-history-*.json) have fired.
 */
import { CROWNS, NATION } from '../../src/sim/content';
import { crownTitle } from '../../src/sim/crowns';
import { answerOffer } from '../../src/sim/commands';
import { ownedRegions } from '../../src/sim/queries';
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { yearOf } from '../../src/sim/util';
import { peaceAcceptance } from '../../src/sim/war';
import west from '../../src/content/events-history-west.json';
import iberiaItaly from '../../src/content/events-history-iberia-italy.json';
import empireNorth from '../../src/content/events-history-empire-north.json';
import eastBalkans from '../../src/content/events-history-east-balkans.json';
import levant from '../../src/content/events-history-levant-africa-americas.json';

const span = Number(process.argv[2] ?? 56);
const seeds = process.argv.slice(3).map(Number);
const MILESTONES = [1460, 1475, 1500];
const HISTORY = new Set(
  ([...west, ...iberiaItaly, ...empireNorth, ...eastBalkans, ...levant] as { id: string }[]).map(e => e.id),
);

for (const seed of seeds.length ? seeds : [1, 2, 3]) {
  const s = newGame({ player: 'POR', seed });
  s.flags.__spectate = 1; // the AI plays everyone
  console.log(`seed ${seed}`);
  const said = new Set<number>();
  for (let d = 0; d < Math.round(span * 365.25); d++) {
    advanceDay(s);
    // The spectated player answers peace offers as the AI would (otherwise its wars never end).
    for (const o of [...s.offers])
      if (o.kind === 'peace')
        answerOffer(s, o.id, !!s.wars[o.war] && peaceAcceptance(s, s.wars[o.war], o.terms, s.player).accept);
    for (const c of CROWNS) {
      const by = Object.keys(s.nations).find(n => s.nations[n].flags['crown_' + c.id] === s.day);
      if (by) console.log(`  ${yearOf(s.day)} ${NATION[by].name} proclaims ${crownTitle(c.id)}`);
    }
    const y = yearOf(s.day);
    if (MILESTONES.includes(y) && !said.has(y)) {
      said.add(y);
      const alive = Object.values(s.nations).filter(n => n.alive).length;
      const fired = Object.keys(s.firedEvents).filter(id => HISTORY.has(id)).length;
      console.log(
        `  ${y}: ${alive} realms, Naples ${ownedRegions(s, 'NAP').length} regions, history events ${fired} of ${HISTORY.size}`,
      );
    }
  }
  const crowns = CROWNS.filter(c => s.flags['crown_' + c.id] !== undefined).length;
  console.log(`  by ${yearOf(s.day)}: ${crowns} crowns proclaimed`);
}
