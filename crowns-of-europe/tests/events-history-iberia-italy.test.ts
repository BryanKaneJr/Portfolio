import { applyEffect, evalCondition } from '../src/sim/events';
import { newGame } from '../src/sim/state';
import type { Effect, EventDef } from '../src/sim/types';
import file from '../src/content/events-history-iberia-italy.json';

const events = file as unknown as EventDef[];
const byId = new Map(events.map(e => [e.id, e]));

/** Every `triggerEvent` in a list of effects, with the nation it is sent to (the sender when none is named). */
function triggers(effects: Effect[], sender: string): { id: string; nation: string }[] {
  return effects.flatMap(ef =>
    'triggerEvent' in ef ? [{ id: ef.triggerEvent.id, nation: ef.triggerEvent.nation ?? sender }] : [],
  );
}

describe('history events: Iberia and Italy', () => {
  test('the file holds the 23 planned cards', () => {
    expect(events).toHaveLength(23);
    expect(new Set(events.map(e => e.id)).size).toBe(23);
  });

  test.each(events.map(e => [e.id, e] as const))(
    '%s: trigger reads and every choice applies without a throw',
    (_id, e) => {
      const n = e.nations![0];
      const base = newGame({ player: n, seed: 3 });
      expect(typeof evalCondition(base, n, e.trigger)).toBe('boolean');
      for (const c of e.choices) {
        const s = newGame({ player: n, seed: 3 });
        expect(() => {
          for (const ef of c.effects) applyEffect(s, n, ef);
        }).not.toThrow();
      }
    },
  );

  test('every hidden card is sent by a choice in this file, to a nation that may receive it', () => {
    const sent = new Map<string, string[]>();
    for (const e of events)
      for (const c of e.choices)
        for (const t of triggers(c.effects, e.nations![0])) sent.set(t.id, [...(sent.get(t.id) ?? []), t.nation]);
    for (const e of events.filter(x => x.hidden)) {
      expect(sent.has(e.id)).toBe(true);
      for (const nation of sent.get(e.id)!) expect(e.nations).toContain(nation);
    }
    // Every follow-up named here exists in this file.
    for (const id of sent.keys()) expect(byId.has(id)).toBe(true);
  });

  test('a card that builds up or fortifies a named region only fires while you own it', () => {
    for (const e of events) {
      const guards = 'all' in e.trigger ? e.trigger.all : [e.trigger];
      for (const c of e.choices)
        for (const ef of c.effects) {
          const region = 'devRegion' in ef ? ef.devRegion.region : 'fortRegion' in ef ? ef.fortRegion.region : null;
          if (region) expect([e.id, guards.some(g => 'owns' in g && g.owns === region)]).toEqual([e.id, true]);
        }
    }
  });

  test('the Moor invites the French, and the French card can then fire against Naples', () => {
    const s = newGame({ player: 'MLO', seed: 3 });
    const invite = byId.get('mlo_the_moors_invitation')!;
    for (const ef of invite.choices[0].effects) applyEffect(s, 'MLO', ef);
    expect(s.scheduledEvents.some(x => x.event === 'fra_called_into_italy' && x.nation === 'FRA')).toBe(true);
    const called = byId.get('fra_called_into_italy')!;
    expect(evalCondition(s, 'FRA', called.trigger)).toBe(true);
    for (const ef of called.choices[0].effects) applyEffect(s, 'FRA', ef);
    expect(Object.values(s.wars).some(w => w.attackers.includes('FRA') && w.defenders.includes('NAP'))).toBe(true);
  });
});
