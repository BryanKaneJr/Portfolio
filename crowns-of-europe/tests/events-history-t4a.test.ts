import west from '../src/content/events-history-west.json';
import levant from '../src/content/events-history-levant-africa-americas.json';
import { EVENT } from '../src/sim/content';
import { answerEvent, evalCondition, fireEvent } from '../src/sim/events';
import { makeArmy, newGame } from '../src/sim/state';
import { pathFromTree, pathTree } from '../src/sim/military';
import { advanceDay } from '../src/sim/tick';
import type { EventDef, NationId } from '../src/sim/types';

const FILES: [string, EventDef[]][] = [
  ['west', west as EventDef[]],
  ['levant-africa-americas', levant as EventDef[]],
];
// A card for any nation is played by the crown that owns the region its trigger asks about.
const ANY: Record<string, NationId> = { low_beggars_of_the_sea: 'BUR' };

describe.each(FILES)('events-history-%s', (_key, events) => {
  test('every card is loaded', () => {
    for (const e of events) expect(EVENT[e.id]).toEqual(e);
  });

  test.each(events.map(e => [e.id, e] as const))('%s: each choice applies without a throw', (_id, e) => {
    const n = e.nations?.[0] ?? ANY[e.id];
    expect(n).toBeDefined();
    e.choices.forEach((_c, i) => {
      const s = newGame({ player: n, seed: 7 });
      expect(typeof evalCondition(s, n, e.trigger)).toBe('boolean');
      fireEvent(s, n, e);
      expect(s.pendingEvents).toHaveLength(1);
      expect(answerEvent(s, 0, i)).toBe(true);
      expect(() => advanceDay(s)).not.toThrow();
    });
  });

  test('hidden cards are reached from a choice in the same file, and follow-ups exist there', () => {
    const ids = new Set(events.map(e => e.id));
    const targets = new Set<string>();
    for (const e of events)
      for (const c of e.choices) for (const ef of c.effects) if ('triggerEvent' in ef) targets.add(ef.triggerEvent.id);
    for (const t of targets) expect(ids).toContain(t);
    for (const e of events.filter(x => x.hidden)) expect(targets).toContain(e.id);
  });
});

test('Morocco cannot march to Gao overland, so the Sahara card arms musketeers instead of declaring war', () => {
  const s = newGame({ player: 'MOR', seed: 7 });
  const a = makeArmy(s, 'MOR', 'fez', 5, 0, 0);
  expect(pathFromTree(pathTree(s, a, { ignoreAccess: true, land: true, to: 'gao' }), 'fez', 'gao')).toBeNull();
  const go = EVENT.mor_across_the_sahara.choices[0].effects;
  expect(go.some(ef => 'declareWar' in ef)).toBe(false);
  expect(go).toContainEqual({ addClaim: ['gao', 'timbuktu'] });
  expect(go).toContainEqual({
    modifier: { id: 'judar_pasha', name: "Judar Pasha's Musketeers", months: 120, mods: { morale: 0.1 } },
  });
});
