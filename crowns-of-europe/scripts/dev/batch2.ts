/**
 * Dev tool: fun batch 2 in AI-only games. npx tsx scripts/dev/batch2.ts [years] [seeds...]
 * Prints, per seed: wars declared and realms alive; golden ages (year, realm); crackdowns, estates seized and
 * abdications; storms tried, won and men lost, and forts taken by storm; AI peaces with Humble them or Reparations;
 * endowments by field; bankruptcies; England's and France's regions; and who holds each landmark at the end.
 * The counters are the modules' dev-only `COUNTS` (the game never reads them).
 */
import { LANDMARKS } from '../../src/sim/content';
import { answerOffer } from '../../src/sim/commands';
import { COUNTS as ENDOW } from '../../src/sim/endowment';
import { ownedRegions } from '../../src/sim/queries';
import { COUNTS as REALM } from '../../src/sim/realm';
import { COUNTS as STORMS } from '../../src/sim/siege';
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { yearOf } from '../../src/sim/util';
import { COUNTS as PEACES, peaceAcceptance } from '../../src/sim/war';

const span = Number(process.argv[2] ?? 116);
const seeds = process.argv.slice(3).map(Number);

for (const seed of seeds.length ? seeds : [1, 2, 3]) {
  // The counters are module-level: zero them for each game.
  Object.assign(REALM, { crackdowns: 0, seized: 0, abdications: 0, golden: [] });
  Object.assign(STORMS, { tried: 0, won: 0, men: 0, wonAt: {} });
  Object.assign(PEACES, { peaces: 0, humbled: 0, reparations: 0 });
  ENDOW.byField = { war: 0, sea: 0, state: 0 };
  const s = newGame({ player: 'POR', seed });
  s.flags.__spectate = 1; // the AI plays everyone
  const wars = new Set<string>();
  const bankrupt = new Map<string, number>(); // realm → the end of the bankruptcy last seen
  let bankruptcies = 0;
  let stormedForts = 0;
  const end = s.day + Math.round(span * 365.25);
  while (s.day < end) {
    advanceDay(s);
    for (const o of [...s.offers]) if (o.kind === 'peace') answerOffer(s, o.id, !!s.wars[o.war] && peaceAcceptance(s, s.wars[o.war], o.terms, s.player).accept);
    for (const w of Object.values(s.wars)) wars.add(w.id);
    for (const day of Object.values(STORMS.wonAt)) if (day === s.day) stormedForts++;
    if (s.day % 30) continue;
    for (const n of Object.values(s.nations)) {
      const b = n.alive ? n.modifiers.find(m => m.id === 'bankrupt') : undefined;
      if (b && b.until !== bankrupt.get(n.id)) {
        bankrupt.set(n.id, b.until ?? 0);
        bankruptcies++;
      }
    }
  }
  const alive = Object.values(s.nations).filter(n => n.alive && ownedRegions(s, n.id).length > 0).length;
  const size = (n: string) => (s.nations[n]?.alive ? ownedRegions(s, n).length : 0);
  console.log(`seed ${seed} to ${yearOf(s.day)}: ${wars.size} wars, ${alive} realms alive, England ${size('ENG')} regions, France ${size('FRA')}`);
  console.log(`  golden ages: ${REALM.golden.map(g => `${g.year} ${g.n}`).join(', ') || 'none'}`);
  console.log(`  crackdowns ${REALM.crackdowns}, estates seized ${REALM.seized}, abdications ${REALM.abdications}, bankruptcies ${bankruptcies}`);
  console.log(`  storms ${STORMS.tried} tried, ${STORMS.won} won, ${STORMS.men.toLocaleString()} men lost; forts taken by storm ${stormedForts}`);
  console.log(`  AI peaces ${PEACES.peaces}: humbled ${PEACES.humbled}, reparations ${PEACES.reparations}`);
  console.log(`  endowed: war ${ENDOW.byField.war}, sea ${ENDOW.byField.sea}, statecraft ${ENDOW.byField.state}`);
  console.log(`  landmarks: ${LANDMARKS.map(l => `${l.id} ${s.regions[l.region]?.owner ?? '-'}`).join(', ')}`);
}
