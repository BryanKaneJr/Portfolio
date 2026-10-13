/**
 * Dev tool: the colonial race over a whole AI-only game. npx tsx scripts/dev/colonies.ts [years] [seeds...]
 * Prints one JSON line per seed: when the New World was found and by whom; the uncolonized New World regions left
 * at milestone years; for each colonial crown its first colony, New World regions and busy/total colonists at those
 * years (colonists settling + growing / all) and its share of income from exports in 1700; colonies lost to natives and to raids; and how many New World
 * regions changed hands in wars. The spectated player answers peace offers as the AI would.
 */
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { answerOffer } from '../../src/sim/commands';
import * as colonies from '../../src/sim/colonies';
import { colonistsOf, coloniesOf, goodsIncome, newWorldRegions } from '../../src/sim/colonies';
import { REGION } from '../../src/sim/content';
import { peaceAcceptance } from '../../src/sim/war';
import { yearOf } from '../../src/sim/util';
import type { GameState, NationId } from '../../src/sim/types';

const span = Number(process.argv[2] ?? 306);
const seeds = process.argv.slice(3).map(Number);
const MILESTONES = [1500, 1525, 1550, 1575, 1600, 1650, 1700, 1750];
const CROWNS: NationId[] = ['POR', 'CAS', 'ENG', 'FRA', 'BUR', 'DAN', 'SCO', 'SWE', 'ARA'];
const NW = Object.keys(REGION).filter(id => REGION[id].nw);

for (const seed of seeds.length ? seeds : [1, 2, 3]) {
  const s: GameState = newGame({ player: 'POR', seed });
  s.flags.__spectate = 1; // the AI plays everyone
  const first: Record<string, number> = {};
  const at: Record<number, { wild: number; settling: number; crowns: Record<string, string> }> = {};
  let lostToNatives = 0;
  let lostToRaids = 0;
  let changedHands = 0;
  const owner = new Map(NW.map(id => [id, s.regions[id].owner]));
  const settling = new Map<string, NationId>(); // region -> who was settling it yesterday
  let incomeShare: Record<string, number> = {};
  for (let d = 0; d < Math.round(span * 365.25); d++) {
    advanceDay(s);
    for (const o of [...s.offers]) if (o.kind === 'peace') answerOffer(s, o.id, !!s.wars[o.war] && peaceAcceptance(s, s.wars[o.war], o.terms, s.player).accept);
    const y = yearOf(s.day);
    for (const id of NW) {
      const r = s.regions[id];
      // A colony gone without being founded: lost (natives, or an enemy army's raids).
      const was = settling.get(id);
      if (was && !r.colony && r.owner !== was) {
        const raided = (r as { lastRaid?: number }).lastRaid !== undefined && s.day - (r as { lastRaid?: number }).lastRaid! < 40;
        if (raided) lostToRaids++;
        else lostToNatives++;
      }
      if (r.colony) settling.set(id, r.colony.by);
      else settling.delete(id);
      // Taken from one crown by another (in a war, or by a release or succession).
      const before = owner.get(id);
      if (r.owner && before && r.owner !== before) changedHands++;
      owner.set(id, r.owner);
      if (r.owner && first[r.owner] === undefined && CROWNS.includes(r.owner)) first[r.owner] = y;
    }
    if (d % 365 === 364 && MILESTONES.includes(y)) {
      const crowns: Record<string, string> = {};
      for (const n of CROWNS) {
        if (!s.nations[n]?.alive) continue;
        // New World regions; colonists settling + growing / all of them (growing: older versions have none).
        const grow = (colonies as { growingOf?: (s: GameState, n: NationId) => unknown[] }).growingOf?.(s, n).length ?? 0;
        crowns[n] = `${newWorldRegions(s, n).length}nw ${coloniesOf(s, n).length}+${grow}/${colonistsOf(s, n)}c`;
      }
      at[y] = { wild: NW.filter(id => !s.regions[id].owner).length, settling: NW.filter(id => !!s.regions[id].colony).length, crowns };
      if (y === 1700) {
        incomeShare = {};
        for (const n of CROWNS) {
          const nat = s.nations[n];
          if (!nat?.alive) continue;
          const goods = newWorldRegions(s, n).reduce((t, r) => t + goodsIncome(s, r), 0);
          if (goods > 0) incomeShare[n] = Math.round((100 * goods) / Math.max(1, nat.lastMonthIncome));
        }
      }
    }
  }
  console.log(
    JSON.stringify({
      seed,
      found: s.discovery ? `${yearOf(s.discovery.day)} ${s.discovery.by ?? 'everyone'}` : 'never',
      first,
      at,
      lostToNatives,
      lostToRaids,
      nwChangedHands: changedHands,
      exportsShareOfIncome1700: incomeShare,
    }),
  );
}
