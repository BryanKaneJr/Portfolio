/** Every nation playable: picker data, the player's crown kept from unions, New World peoples, and a short smoke run of all 73. */
import { EVENT, GRAPH, NATIONS, isSea } from '../src/sim/content';
import { answerOffer, moveArmy, playerAnswerEvent, playerDeclareWar } from '../src/sim/commands';
import { colonialCrown, discoverNewWorld } from '../src/sim/colonies';
import { applyEffects, evalCondition } from '../src/sim/events';
import { missionsFor } from '../src/sim/missions';
import { availableAdvances } from '../src/sim/science';
import { newGame } from '../src/sim/state';
import { advanceDay } from '../src/sim/tick';
import { peaceAcceptance } from '../src/sim/war';
import type { GameState, NationId } from '../src/sim/types';

const NATIVES = NATIONS.filter(n => n.native).map(n => n.id);

/** Run `days` with a passive player: first choice on every card, no to every offer, yes to a peace the AI would take. */
function runPassive(s: GameState, days: number): void {
  for (let d = 0; d < days && !s.gameOver; d++) {
    advanceDay(s);
    while (s.pendingEvents.length) if (!playerAnswerEvent(s, 0, 0).ok) s.pendingEvents.shift();
    for (const o of [...s.offers])
      answerOffer(
        s,
        o.id,
        o.kind === 'peace' && !!s.wars[o.war] && peaceAcceptance(s, s.wars[o.war], o.terms, s.player).accept,
      );
  }
}

describe('picker data', () => {
  test('every nation has a difficulty and an area; the great powers are still the 22', () => {
    for (const n of NATIONS) {
      expect(n.difficulty).toBeTruthy();
      expect(n.area).toBeTruthy();
    }
    expect(NATIONS.filter(n => n.playable)).toHaveLength(22);
    expect(NATIONS.find(n => n.id === 'MAM')!.difficulty).toBe('normal');
    expect(NATIONS.find(n => n.id === 'KAR')!.difficulty).toBe('very_hard');
  });
});

describe("the player's crown", () => {
  test('Poland cannot take Lithuania into a union when Lithuania is the player', () => {
    const s = newGame({ player: 'LIT', seed: 1 });
    applyEffects(s, 'POL', EVENT.pol_lit_union.choices[0].effects);
    expect(s.nations.LIT.overlord).toBeUndefined();
    applyEffects(s, 'POL', EVENT.pol_union_of_lublin.choices[0].effects);
    expect(s.nations.LIT.alive).toBe(true);
    expect(s.log.some(l => l.text === 'Poland claims your crown; your lords refuse.' && l.important)).toBe(true);
  });

  test('the same union still happens to an AI realm', () => {
    const s = newGame({ player: 'FRA', seed: 1 });
    applyEffects(s, 'POL', EVENT.pol_lit_union.choices[0].effects);
    expect(s.nations.LIT.overlord).toBe('POL');
  });
});

describe('New World peoples', () => {
  test('no advances, no colonial business, missions they can finish', () => {
    const s = newGame({ player: 'HAU', seed: 1 });
    expect(availableAdvances(s, 'HAU')).toEqual([]);
    expect(availableAdvances(s, 'FRA').length).toBeGreaterThan(0);
    for (const n of NATIVES) expect(colonialCrown(s, n)).toBe(false);
    const ids = missionsFor('HAU').map(m => m.id);
    expect(ids).not.toContain('gen_friends_abroad');
    expect(ids).not.toContain('gen_the_western_sea');
    expect(ids).toContain('gen_a_name_abroad');
    expect(missionsFor('HAU').find(m => m.id === 'gen_a_name_abroad')!.requires).toEqual([]);
    // None left that shuts natives out, and no lock on a mission they no longer have.
    for (const m of missionsFor('HAU')) {
      expect(JSON.stringify(m.goal)).not.toMatch(/"native":false|alliesAtLeast|coloniesAtLeast/);
      for (const r of m.requires) expect(ids).toContain(r);
    }
    // Europeans keep the full generic list.
    expect(missionsFor('PRO').map(m => m.id)).toContain('gen_friends_abroad');
  });

  test('European-flavoured era cards pass them by', () => {
    const s = newGame({ player: 'AZT', seed: 1 });
    expect(evalCondition(s, 'AZT', EVENT.era_printing_press.trigger)).toBe(false);
    expect(evalCondition(s, 'FRA', EVENT.era_printing_press.trigger)).toBe(true);
  });

  test('the discovery brings them strangers from the sea, not a call to sail west', () => {
    const s = newGame({ player: 'AZT', seed: 1 });
    discoverNewWorld(s, null);
    expect(s.pendingEvents.map(e => e.event)).toEqual(['nw_strangers_from_the_sea']);
    const e = newGame({ player: 'POR', seed: 1 });
    discoverNewWorld(e, null);
    expect(e.pendingEvents.map(x => x.event)).toEqual(['new_world']);
  });
});

describe('every nation starts and plays 60 days', () => {
  test.each(NATIONS.map(n => n.id))('%s', (id: NationId) => {
    if (NATIVES.includes(id)) {
      // A one-step march is accepted: into its own or free land, or (hemmed in, like the Maya) into a neighbour's at war.
      const w = newGame({ player: id, seed: 1 });
      const a = Object.values(w.armies).find(x => x.owner === id)!;
      const land = GRAPH[a.node].filter(e => !isSea(e.to)).map(e => e.to);
      let to = land.find(r => w.regions[r].owner === id || !w.regions[r].owner);
      if (!to) {
        to = land[0];
        expect(playerDeclareWar(w, w.regions[to].owner!).ok).toBe(true);
      }
      expect(moveArmy(w, a.id, to).ok).toBe(true);
    }
    const s = newGame({ player: id, seed: 1 });
    const overlord = s.nations[id].overlord;
    runPassive(s, 60);
    expect(s.gameOver).toBeUndefined();
    expect(s.nations[id].alive).toBe(true);
    expect(s.nations[id].overlord).toBe(overlord);
  });
});
