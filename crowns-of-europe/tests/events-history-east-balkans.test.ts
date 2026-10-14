import { newGame } from '../src/sim/state';
import { applyEffects, evalCondition } from '../src/sim/events';
import { EVENT } from '../src/sim/content';
import type { Effect, EventDef, GameState, NationId } from '../src/sim/types';
import FILE from '../src/content/events-history-east-balkans.json';

const events = FILE as unknown as EventDef[];

/** A fresh 1444 game, quiet so that only the effects under test change anything. */
function game(player: NationId): GameState {
  const s = newGame({ player, seed: 11 });
  s.flags.__noAI = 1;
  s.flags.__noEvents = 1;
  return s;
}

const flat = (effects: Effect[]): Record<string, any>[] => effects as Record<string, any>[];
const chainsOf = (e: EventDef) =>
  e.choices.flatMap((c, i) =>
    flat(c.effects)
      .filter(x => x.triggerEvent)
      .map(x => ({
        choice: i,
        id: x.triggerEvent.id as string,
        nation: (x.triggerEvent.nation ?? e.nations![0]) as NationId,
      })),
  );
const warOf = (s: GameState, a: NationId, b: NationId) =>
  Object.values(s.wars).find(w => w.attackers.includes(a) && w.defenders.includes(b));

describe('history events: the east and the Balkans', () => {
  test('the file is loaded into the game', () => {
    expect(events.length).toBe(22);
    for (const e of events) expect(EVENT[e.id]).toBe(e);
  });

  test('every choice applies without a throw for every listed nation', () => {
    for (const e of events) {
      for (const n of e.nations ?? []) {
        for (const c of e.choices) {
          const s = game(n);
          expect(typeof evalCondition(s, n, e.trigger)).toBe('boolean');
          expect(() => applyEffects(s, n, c.effects)).not.toThrow();
        }
      }
    }
  });

  test('every hidden event is reached from a choice in this file, and fires when it arrives', () => {
    const chains = events.flatMap(e => chainsOf(e).map(c => ({ ...c, from: e })));
    for (const e of events.filter(x => x.hidden)) expect(chains.map(c => c.id)).toContain(e.id);
    for (const c of chains) {
      const target = events.find(e => e.id === c.id)!;
      expect(target).toBeDefined();
      expect(target.nations).toContain(c.nation);
      // In a 1444 world, the choice that sends the follow-up leaves its trigger true when it comes due.
      const s = game(c.from.nations![0]);
      applyEffects(s, c.from.nations![0], c.from.choices[c.choice].effects);
      expect(s.scheduledEvents).toContainEqual(expect.objectContaining({ event: c.id, nation: c.nation }));
      expect(evalCondition(s, c.nation, target.trigger)).toBe(true);
    }
  });

  test('the wars these cards declare really start', () => {
    // Each case: the card, the choice, and who should be at war with whom. Hidden cards first run the choice that sends them.
    const cases: [string, number, NationId, NationId][] = [
      ['mos_pskov_defies', 0, 'MOS', 'PSK'],
      ['mos_treason_in_tver', 0, 'MOS', 'TVE'],
      ['gol_the_river_ugra', 0, 'GOL', 'MOS'],
      ['gol_the_khan_in_crimea', 0, 'GOL', 'CRI'],
      ['ser_the_old_despot_dies', 0, 'SER', 'TUR'],
      ['psk_lake_peipus', 1, 'PSK', 'LIV'],
    ];
    for (const [id, choice, a, b] of cases) {
      const e = EVENT[id];
      const s = game(a);
      const parent = events.find(p => chainsOf(p).some(c => c.id === id));
      if (parent)
        applyEffects(s, parent.nations![0], parent.choices[chainsOf(parent).find(c => c.id === id)!.choice].effects);
      expect(evalCondition(s, a, e.trigger)).toBe(true);
      applyEffects(s, a, e.choices[choice].effects);
      expect(warOf(s, a, b)).toBeDefined();
    }
  });

  test('Serbia fights for its freedom with Hungary at its side', () => {
    const s = game('SER');
    expect(s.nations.SER.overlord).toBe('TUR');
    applyEffects(s, 'SER', EVENT.ser_the_old_despot_dies.choices[0].effects);
    const war = warOf(s, 'SER', 'TUR')!;
    expect(war.cb).toBe('independence');
    expect(s.nations.SER.overlord).toBe('TUR'); // no free release
    expect(s.alliances[['HUN', 'SER'].sort().join('|')]).toBeDefined();
  });

  test('Venice can take Albania under its protection', () => {
    const s = game('VEN');
    applyEffects(s, 'ALB', EVENT.alb_the_dragon_dies.choices[0].effects);
    applyEffects(s, 'VEN', EVENT.ven_kruje_in_trust.choices[0].effects);
    expect(s.nations.ALB.overlord).toBe('VEN');
  });
});
