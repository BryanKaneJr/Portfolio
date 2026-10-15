import { emptyGame, army, forceWar } from './helpers';
import { declareWar } from '../src/sim/war';
import { advanceDay, advanceDays } from '../src/sim/tick';
import { armyMen } from '../src/sim/queries';
import { STAR_BONUS, newGeneral, starBonus } from '../src/sim/rulers';
import { edgeDays } from '../src/sim/military';
import { siegeInfo } from '../src/sim/siege';
import { GRAPH, isSea } from '../src/sim/content';
import type { Army, GameState } from '../src/sim/types';

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

describe('retreats', () => {
  /** A shaken Turkish army landed on Crete (one region, no land route off it) is beaten by Venice. */
  function islandBattle(transports: number): { s: GameState; tur: Army } {
    const s = emptyGame('TUR');
    forceWar(s, 'TUR', 'VEN');
    const tur = army(s, 'TUR', 'candia', 6);
    army(s, 'VEN', 'candia', 10);
    if (transports)
      s.fleets.f1 = { id: 'f1', name: 'Transports', owner: 'TUR', sea: 'aegean', ships: { galley: 0, transport: transports, warship: 0 }, hull: 1, path: [], progress: 0, edgeDays: 0 };
    advanceDay(s);
    tur.morale *= 0.3;
    declareWar(s, 'TUR', 'VEN', 'none');
    for (let i = 0; i < 30 && !s.reports.length; i++) advanceDay(s);
    return { s, tur };
  }

  test('a beaten island army with transports nearby escapes by sea to a friendly coast', () => {
    const { s, tur } = islandBattle(2);
    const r = s.reports[0];
    expect(r.nations[r.winner]).toContain('VEN');
    expect(r.wiped).toBe(false);
    expect(r.scattered).toBeUndefined();
    expect(s.armies[tur.id]).toBe(tur);
    expect(tur.retreating).toBe(true);
    // Every step is a road it can take, out over the sea and into land Turkey holds.
    let at = tur.node;
    for (const n of tur.path) {
      expect(GRAPH[at].some(e => e.to === n)).toBe(true);
      at = n;
    }
    const seas = tur.path.filter(isSea);
    expect(seas.length).toBeGreaterThan(0);
    expect(s.regions[at].controller).toBe('TUR');
    advanceDays(s, 40);
    expect(tur.node).toBe(at);
    expect(tur.retreating).toBe(false);
    expect(s.fleets.f1.sea).toBe(seas[seas.length - 1]); // the transports sailed with it
  });

  test('with no way out it scatters: the report says so and counts every man', () => {
    const { s, tur } = islandBattle(0);
    const r = s.reports[0];
    const lost = 1 - r.winner;
    expect(r.nations[lost]).toContain('TUR');
    expect(r.wiped).toBe(false);
    expect(r.scattered).toBe(true);
    expect(s.armies[tur.id]).toBeUndefined();
    expect(Math.abs(r.losses[lost] - r.startMen[lost])).toBeLessThan(50);
    expect(r.warScore).toBeGreaterThan(0);
    expect(s.log.some(l => l.important && l.text.startsWith(`The ${tur.name} has nowhere to retreat from Candia and scatters:`) && / more men lost \([\d,]+ in all\)\.$/.test(l.text))).toBe(true);
  });
});

describe('generals', () => {
  /** France attacks Burgundy, a fifth fewer, into Burgundy's own ground: how many of these seeds does France win? */
  const frenchWins = (stars: number, seeds: number[]) =>
    seeds.filter(seed => {
      const s = emptyGame('ENG', seed);
      forceWar(s, 'FRA', 'BUR');
      declareWar(s, 'FRA', 'BUR', 'none');
      const a = army(s, 'FRA', 'champagne', 12, 5);
      army(s, 'BUR', 'burgundy', 15, 5);
      if (stars) a.general = newGeneral(s, 'FRA', { stars });
      advanceDay(s);
      a.path = ['burgundy'];
      advanceDays(s, 40);
      return s.reports[0]?.winner === 0;
    }).length;

  test('each star adds 10% to everything the army does', () => {
    expect(STAR_BONUS).toBe(0.1);
    expect(starBonus({ stars: 3 })).toBeCloseTo(0.3);
    expect(starBonus(undefined)).toBe(0);
    // Hired generals have 1 to 5 stars; content can name the number.
    const s = emptyGame('FRA');
    for (let i = 0; i < 50; i++) expect([1, 2, 3, 4, 5]).toContain(newGeneral(s, 'FRA').stars);
    expect(newGeneral(s, 'FRA', { stars: 9 }).stars).toBe(5);
  });

  test('a great general wins battles a smaller army would lose', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const without = frenchWins(0, seeds);
    const withFive = frenchWins(5, seeds);
    expect(without).toBeLessThanOrEqual(8);
    // Five stars (+50% damage, morale lost ÷ 1.5) more than make up for three regiments.
    expect(withFive).toBeGreaterThanOrEqual(11);
  });

  test('stars quicken the march and the siege', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'FRA', 'BUR');
    declareWar(s, 'FRA', 'BUR', 'none');
    const a = army(s, 'FRA', 'burgundy', 12, 0, 2);
    s.regions.burgundy.fort = 2;
    const edge = GRAPH.champagne.find(e => e.to === 'burgundy')!;
    const plain = siegeInfo(s, 'burgundy')!.daily;
    const slow = edgeDays(s, a, 'champagne', edge);
    a.general = newGeneral(s, 'FRA', { stars: 4 });
    expect(siegeInfo(s, 'burgundy')!.daily).toBeCloseTo(plain * 1.4);
    // Days are whole, so the march is the old one over 1.4, rounded.
    expect(Math.abs(edgeDays(s, a, 'champagne', edge) - slow / 1.4)).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(edgeDays(s, a, 'champagne', edge)).toBeLessThan(slow);
  });
});
