import FILE from '../src/content/events-history-empire-north.json';
import { EVENT } from '../src/sim/content';
import { answerEvent, evalCondition, fireEvent } from '../src/sim/events';
import { newGame } from '../src/sim/state';
import type { Effect, EventDef, GameState, NationId } from '../src/sim/types';

/** History cards for the Empire and the north (T4c): every choice runs, every war card starts its war, chains close. */
const CARDS = FILE as unknown as EventDef[];

/** A fresh 1444 game as `n`, with the AI and random events off so only the card acts. */
function fresh(n: NationId): GameState {
  const s = newGame({ player: n, seed: 7 });
  s.flags.__noAI = 1;
  s.flags.__noEvents = 1;
  return s;
}

/** Fire the card at `n` (the player) and pick choice `i`. */
function play(s: GameState, n: NationId, e: EventDef, i: number): boolean {
  fireEvent(s, n, e);
  return answerEvent(s, s.pendingEvents.length - 1, i);
}

const triggered = (effects: Effect[]) =>
  effects.flatMap(ef =>
    'triggerEvent' in ef ? [(ef as { triggerEvent: { id: string; nation?: NationId } }).triggerEvent] : [],
  );

describe('history events: Empire and north', () => {
  test('the file is loaded into the game', () => {
    expect(CARDS).toHaveLength(24);
    for (const e of CARDS) expect(EVENT[e.id]).toBeDefined();
  });

  test('every choice of every card runs for every listed nation', () => {
    for (const e of CARDS) {
      for (const n of e.nations ?? []) {
        const base = fresh(n);
        e.choices.forEach((_, i) => {
          const s = structuredClone(base);
          expect(() => expect(play(s, n, e, i)).toBe(true)).not.toThrow();
          expect(s.pendingEvents.find(p => p.event === e.id)).toBeUndefined();
        });
      }
    }
  });

  test('every war choice really starts its war once the card can fire', () => {
    /** Late cards wait on world flags; set those up so their war choice is tested too. */
    const setup: Record<string, (s: GameState) => void> = {
      dan_lower_saxon_war: s => {
        s.flags.thirty_years_war = 1;
        s.nations.DAN.faith = 'protestant';
      },
    };
    const started: string[] = [];
    for (const e of CARDS) {
      const n = e.nations![0];
      const base = fresh(n);
      setup[e.id]?.(base);
      e.choices.forEach((c, i) => {
        const dw = c.effects.find(ef => 'declareWar' in ef) as { declareWar: { target: NationId } } | undefined;
        if (!dw) return;
        expect({ card: e.id, canFire: evalCondition(base, n, e.trigger) }).toEqual({ card: e.id, canFire: true });
        const s = structuredClone(base);
        play(s, n, e, i);
        const war = Object.values(s.wars).find(
          w => w.attackers.includes(n) && w.defenders.includes(dw.declareWar.target),
        );
        if (war) started.push(`${e.id}:${n}-${dw.declareWar.target}`);
      });
    }
    expect(started.sort()).toEqual([
      'bav_landshut_inheritance:BAV-PAL',
      'bra_stettin_inheritance:BRA-POM',
      'dan_lower_saxon_war:DAN-HAB',
      'hsa_the_counts_feud:HSA-DAN',
      'hun_crusade_against_bohemia:HUN-BOH',
    ]);
  });

  test('hidden cards are reached from a choice in this file, and every follow-up exists', () => {
    const sent = CARDS.flatMap(e => e.choices.flatMap(c => triggered(c.effects)));
    for (const t of sent) {
      const target = CARDS.find(e => e.id === t.id);
      expect(target).toBeDefined();
      if (t.nation && target!.nations) expect(target!.nations).toContain(t.nation);
    }
    for (const e of CARDS.filter(x => x.hidden)) expect(sent.map(t => t.id)).toContain(e.id);
  });

  test('a hidden follow-up can fire for its nation at the start', () => {
    for (const e of CARDS.filter(x => x.hidden)) {
      const n = e.nations![0];
      expect({ card: e.id, ok: evalCondition(fresh(n), n, e.trigger) }).toEqual({ card: e.id, ok: true });
    }
  });

  test('shared cards repeat per nation and every choice sets their guard', () => {
    for (const e of CARDS.filter(x => (x.nations?.length ?? 0) > 1)) {
      expect(e.once).toBe(false);
      const guard = JSON.stringify(e.trigger).match(/"nationFlag":"(\w+)"/)?.[1];
      expect(guard).toBeDefined();
      for (const c of e.choices) expect(c.effects).toContainEqual({ setNationFlag: guard });
    }
  });
});
