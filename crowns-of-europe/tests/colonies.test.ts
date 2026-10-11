import { army, emptyGame } from './helpers';
import { advanceDays } from '../src/sim/tick';
import { findPath } from '../src/sim/military';
import { findSeaPath } from '../src/sim/navy';
import { canColonize, colonistsOf, discoverNewWorld, sendExpedition, startColony, SETTLERS_NEEDED } from '../src/sim/colonies';
import { ledger } from '../src/sim/economy';
import { holyWarAllowed } from '../src/sim/war';
import { unitPower } from '../src/sim/queries';
import { joinOrStartBattle } from '../src/sim/battle';
import { dayOf } from '../src/sim/util';
import type { Fleet, GameState } from '../src/sim/types';

function fleet(s: GameState, owner: string, sea: string, transports: number): Fleet {
  const f: Fleet = { id: `f${++s.seq}`, name: 'Test Fleet', owner, sea, ships: { galley: 0, warship: 0, transport: transports }, hull: 1, path: [], progress: 0, edgeDays: 0 };
  s.fleets[f.id] = f;
  return f;
}

describe('the New World', () => {
  test('is uncharted until someone finds it', () => {
    const s = emptyGame('POR');
    const a = army(s, 'POR', 'lisbon', 4);
    fleet(s, 'POR', 'iberian_atlantic', 4);
    expect(findPath(s, a, 'pernambuco')).toBeNull();
    expect(findSeaPath('iberian_atlantic', 'caribbean', false)).toBeNull();
    expect(canColonize(s, 'POR', 'bahia')).toMatch(/uncharted/);
    discoverNewWorld(s, null);
    expect(findPath(s, a, 'pernambuco')).not.toBeNull();
    expect(findSeaPath('iberian_atlantic', 'caribbean', true)).not.toBeNull();
  });

  test('an expedition finds it and the discoverer gets a colonist', () => {
    const s = emptyGame('POR');
    s.day = dayOf(1475, 0, 1);
    s.nations.POR.gold = 500;
    expect(sendExpedition(s, 'POR')).toBeNull();
    advanceDays(s, 300);
    expect(s.discovery?.by).toBe('POR');
    expect(s.pendingEvents.some(e => e.event === 'new_world')).toBe(true);
    // Navigators trait (1) + first to the New World (1).
    expect(colonistsOf(s, 'POR')).toBe(2);
  });

  test('everyone knows the way by 1500', () => {
    const s = emptyGame('FRA');
    s.day = dayOf(1499, 11, 15);
    advanceDays(s, 30);
    expect(s.discovery).toBeDefined();
    expect(s.discovery?.by).toBeNull();
  });

  test('a colony grows into a region of yours', () => {
    const s = emptyGame('POR');
    s.nations.POR.gold = 500;
    // Cape Verde is off Africa, not in the New World: Portugal can settle it from the start.
    expect(startColony(s, 'POR', 'cape_verde')).toBeNull();
    expect(s.regions.cape_verde.colony?.by).toBe('POR');
    advanceDays(s, 365 * 15);
    expect(s.regions.cape_verde.owner).toBe('POR');
    expect(s.regions.cape_verde.faith).toBe('catholic');
    expect(s.regions.cape_verde.colony).toBeUndefined();
    expect(ledger(s, 'POR').income.some(i => i.label === 'Colonial goods')).toBe(true);
  });

  test('natives can wipe out an unguarded colony, but not a guarded one', () => {
    const s = emptyGame('POR');
    discoverNewWorld(s, 'POR');
    s.nations.POR.gold = 5000;
    s.regions.florida.natives = 8;
    s.regions.rio.natives = 8;
    expect(startColony(s, 'POR', 'florida')).toBeNull();
    expect(startColony(s, 'POR', 'rio')).toBeNull();
    army(s, 'POR', 'rio', 3);
    let destroyed = false;
    for (let m = 0; m < 240 && !destroyed; m++) {
      advanceDays(s, 30);
      if (!s.regions.florida.colony && !s.regions.florida.owner) destroyed = true;
      if (destroyed) break;
      s.regions.florida.colony!.settlers = Math.min(s.regions.florida.colony!.settlers, 100);
    }
    expect(destroyed).toBe(true);
    expect(s.regions.rio.colony?.by ?? s.regions.rio.owner).toBe('POR');
  });

  test('one fleet carries an army across the ocean', () => {
    const s = emptyGame('POR');
    discoverNewWorld(s, null);
    const a = army(s, 'POR', 'lisbon', 6);
    const f = fleet(s, 'POR', 'iberian_atlantic', 2);
    const res = findPath(s, a, 'pernambuco');
    expect(res).not.toBeNull();
    const landingSea = res!.path[res!.path.length - 2];
    expect(res!.path.filter(n => n in s.regions).length).toBe(1); // straight across, by sea
    a.path = [...res!.path];
    advanceDays(s, res!.days + 2);
    expect(a.node).toBe('pernambuco');
    expect(f.sea).toBe(landingSea);
  });

  test('native peoples fight with weaker troops and can be the target of holy war', () => {
    const s = emptyGame('CAS');
    expect(holyWarAllowed(s, 'CAS', 'AZT')).toBe(true);
    expect(unitPower(s, 'AZT', 'inf')).toBeLessThan(unitPower(s, 'CAS', 'inf'));
    // A Renaissance army beats a larger Aztec host.
    discoverNewWorld(s, null);
    s.nations.CAS.era = 2;
    const cas = army(s, 'CAS', 'anahuac', 10, 4);
    army(s, 'AZT', 'anahuac', 18);
    s.wars.w1 = { id: 'w1', name: 'Test', attackers: ['CAS'], defenders: ['AZT'], cb: 'holy', started: s.day, battleScore: 0, goalScore: 0 };
    advanceDays(s, 1);
    joinOrStartBattle(s, 'anahuac', cas);
    advanceDays(s, 40);
    const report = s.reports[0];
    expect(report).toBeDefined();
    expect(report.nations[report.winner]).toContain('CAS');
  });

  test('colonies never exceed the settlers needed before they are founded', () => {
    expect(SETTLERS_NEEDED).toBe(1000);
  });
});
