/**
 * Dev tool: every nation as the player, passive, for a few years. npx tsx scripts/dev/playall.ts [years] [ids...]
 * Prints one JSON line per nation: regions and prosperity at the start, its overlord, missions, open advances, whether
 * colonizing concerns it, whether its capital is charted to it, whether its army can take one step, how many
 * neighbours it could ally with or attack, then (after the run) whether it is alive, game over, regions, gold, the
 * events and offers it saw, its wars and its overlord. The player answers every card with its first choice, refuses
 * every offer and takes any peace the AI would. `notes` lists anything that went wrong.
 */
import { newGame } from '../../src/sim/state';
import { advanceDay } from '../../src/sim/tick';
import { answerOffer, moveArmy, playerAnswerEvent, stopArmy } from '../../src/sim/commands';
import { canDeclareWar, casusBelli, peaceAcceptance } from '../../src/sim/war';
import { EVENT, GRAPH, NATIONS, isSea } from '../../src/sim/content';
import { armyRegs, neighborsOf, ownedRegions, totalDev } from '../../src/sim/queries';
import { missionState, missionsFor } from '../../src/sim/missions';
import { availableAdvances } from '../../src/sim/science';
import { acceptance } from '../../src/sim/diplomacy';
import { charted, colonialCrown } from '../../src/sim/colonies';
import type { GameState } from '../../src/sim/types';

const span = Number(process.argv[2] ?? 3);
const only = process.argv.slice(3);

for (const def of NATIONS) {
  if (only.length && !only.includes(def.id)) continue;
  const id = def.id;
  const row: Record<string, unknown> = { id, tier: def.tier, pl: def.playable ? 'P' : '-' };
  const notes: string[] = [];
  const t0 = Date.now();
  try {
    const s: GameState = newGame({ player: id, seed: 1 });
    row.r0 = ownedRegions(s, id).length;
    row.dev0 = totalDev(s, id);
    row.ov0 = s.nations[id].overlord ?? '';
    const mis = missionsFor(id);
    row.mis = `${mis.length}${mis[0]?.nation === 'generic' ? 'g' : ''}`;
    row.adv = availableAdvances(s, id).length;
    row.colonial = colonialCrown(s, id) ? 'Y' : '';
    row.capCharted = charted(s, s.nations[id].capital, id) ? '' : 'NO';
    // Can the player's army take one step?
    const army = Object.values(s.armies).find(a => a.owner === id);
    if (!army) notes.push('no army');
    else {
      const land = GRAPH[army.node].filter(e => !isSea(e.to));
      const to = (land.find(e => s.regions[e.to]?.owner === id) ?? land[0])?.to;
      if (!to) notes.push('army has no land neighbour');
      else {
        const r = moveArmy(s, army.id, to);
        if (!r.ok) notes.push(`move fails: ${r.msg}`);
        else stopArmy(s, army.id);
      }
    }
    // Diplomacy and war against the neighbours.
    const nb = neighborsOf(s, id);
    row.nb = nb.length;
    row.allyable = nb.filter(o => !acceptance(s, id, o, 'alliance').blocked).length;
    row.warable = nb.filter(o => canDeclareWar(s, id, o) === null).length;
    row.cbs = nb.reduce((t, o) => t + casusBelli(s, id, o).filter(c => c.cb !== 'none').length, 0);
    // Run.
    const ev = new Map<string, number>();
    const offers: Record<string, number> = {};
    const wars = new Set<string>();
    let maxPending = 0;
    for (let d = 0; d < Math.round(span * 365.25); d++) {
      advanceDay(s);
      if (s.gameOver) break;
      maxPending = Math.max(maxPending, s.pendingEvents.length);
      while (s.pendingEvents.length) {
        const pe = s.pendingEvents[0];
        if (!EVENT[pe.event]?.choices?.length) notes.push(`event ${pe.event} has no choices`);
        ev.set(pe.event, (ev.get(pe.event) ?? 0) + 1);
        if (!playerAnswerEvent(s, 0, 0).ok) {
          notes.push(`event ${pe.event} answer failed`);
          s.pendingEvents.shift();
        }
      }
      for (const o of [...s.offers]) {
        offers[o.kind] = (offers[o.kind] ?? 0) + 1;
        if (o.kind === 'peace')
          answerOffer(s, o.id, !!s.wars[o.war] && peaceAcceptance(s, s.wars[o.war], o.terms, s.player).accept);
        else answerOffer(s, o.id, false);
      }
      for (const w of Object.values(s.wars))
        if (w.attackers.includes(id) || w.defenders.includes(id)) wars.add(`${w.attackers[0]}>${w.defenders[0]}`);
    }
    const nat = s.nations[id];
    row.alive = nat.alive ? 'Y' : 'DEAD';
    row.over = s.gameOver ? s.gameOver.reason : '';
    row.r1 = nat.alive ? ownedRegions(s, id).length : 0;
    row.gold = Math.round(nat.gold);
    row.events = [...ev.values()].reduce((a, b) => a + b, 0);
    row.evIds = [...ev.keys()].join(',');
    row.offers = Object.entries(offers)
      .map(([k, v]) => `${k}${v}`)
      .join(' ');
    row.wars = [...wars].join(' ');
    row.misReady = missionsFor(id).filter(m => missionState(s, id, m) === 'ready').length;
    row.ov1 = nat.overlord ?? '';
    row.armies = Object.values(s.armies)
      .filter(a => a.owner === id)
      .reduce((t, a) => t + armyRegs(a), 0);
    if (maxPending > 2) notes.push(`pending ${maxPending}`);
  } catch (e) {
    const err = e as Error;
    notes.push(`EXC ${err?.message} ${String(err?.stack).split('\n').slice(1, 4).join(' | ')}`);
  }
  row.notes = notes;
  row.ms = Date.now() - t0;
  console.log(JSON.stringify(row));
}
