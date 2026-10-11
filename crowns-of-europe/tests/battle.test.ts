import { emptyGame, army, forceWar } from './helpers';
import { declareWar } from '../src/sim/war';
import { advanceDay, advanceDays } from '../src/sim/tick';
import { armyMen } from '../src/sim/queries';

describe('battles', () => {
  test('a 40k stack hitting 8k wipes it out within days', () => {
    const s = emptyGame('FRA');
    forceWar(s, 'FRA', 'BUR');
    declareWar(s, 'FRA', 'BUR', 'none');
    const big = army(s, 'FRA', 'champagne', 30, 10);
    const small = army(s, 'BUR', 'burgundy', 6, 2);
    // Defender sits on open plains in Burgundy; France marches in.
    advanceDay(s);
    big.path = ['burgundy'];
    let days = 0;
    while (!s.reports.length && days < 60) {
      advanceDay(s);
      days++;
    }
    const r = s.reports[0];
    expect(r).toBeDefined();
    expect(r.winner).toBe(0);
    expect(r.wiped).toBe(true);
    expect(s.armies[small.id]).toBeUndefined();
    expect(s.armies[big.id]).toBeDefined();
    expect(r.days).toBeLessThanOrEqual(6);
    expect(s.stats.stackWipes).toBe(1);
  });

  test('evenly matched armies fight for several days and the loser retreats', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'FRA', 'BUR');
    declareWar(s, 'FRA', 'BUR', 'none');
    const a = army(s, 'FRA', 'champagne', 15, 5);
    const b = army(s, 'BUR', 'burgundy', 15, 5);
    advanceDay(s);
    a.path = ['burgundy'];
    advanceDays(s, 40);
    const r = s.reports[0];
    expect(r).toBeDefined();
    expect(r.days).toBeGreaterThanOrEqual(3);
    expect(r.wiped).toBe(false);
    const loser = r.winner === 0 ? b : a;
    expect(s.armies[loser.id]).toBeDefined();
    // The loser left the field.
    expect(s.armies[loser.id].node === 'burgundy' && !s.armies[loser.id].retreating && s.armies[loser.id].path.length === 0).toBe(false);
    expect(r.losses[0]).toBeGreaterThan(1000);
    expect(r.losses[1]).toBeGreaterThan(1000);
  });

  test('reinforcements can join a battle in progress', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'FRA', 'BUR');
    declareWar(s, 'FRA', 'BUR', 'none');
    const a = army(s, 'FRA', 'champagne', 12, 3);
    army(s, 'BUR', 'burgundy', 12, 3);
    const late = army(s, 'FRA', 'champagne', 10, 0);
    advanceDay(s);
    a.path = ['burgundy'];
    for (let i = 0; i < 30 && !Object.keys(s.battles).length; i++) advanceDay(s);
    const battle = Object.values(s.battles)[0];
    expect(battle).toBeDefined();
    // The second army arrives while the battle rages.
    late.node = 'burgundy';
    advanceDay(s);
    if (s.battles[battle.id]) expect(s.battles[battle.id].sides[0].armies).toContain(late.id);
    advanceDays(s, 40);
    const r = s.reports.find(x => x.node === 'burgundy' && x.nations[0].includes('FRA'))!;
    expect(r.startMen[0]).toBeGreaterThan(20000);
  });

  test('battle damage scales with the front line, so mountains cap big stacks', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'FRA', 'SAV');
    declareWar(s, 'FRA', 'SAV', 'none');
    const a = army(s, 'FRA', 'lyonnais', 40, 0);
    army(s, 'SAV', 'savoy', 12, 0);
    advanceDay(s);
    a.path = ['savoy'];
    advanceDays(s, 60);
    const r = s.reports[0];
    expect(r).toBeDefined();
    // Even a 40-regiment stack only fights 10 wide in the mountains: it still wins.
    expect(r.winner).toBe(0);
    expect(armyMen(s.armies[a.id])).toBeGreaterThan(20000);
  });
});
