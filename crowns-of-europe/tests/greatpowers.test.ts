import { army, emptyGame, forceWar } from './helpers';
import { acceptance } from '../src/sim/diplomacy';
import { declareWar, imperialDefenders, likelySides, regionPeaceCost } from '../src/sim/war';
import { makeSubject } from '../src/sim/territory';
import { years } from '../src/sim/util';
import { debugAI, sideStrength } from '../src/sim/ai';
import { GENERAL_COST } from '../src/sim/commands';
import { newGeneral } from '../src/sim/rulers';
import { armyRegs, militaryPower } from '../src/sim/queries';
import { proximity } from '../src/sim/threat';
import { newGame } from '../src/sim/state';
import { advanceDays } from '../src/sim/tick';

describe('great powers hold together', () => {
  test('great crowns accept no master by treaty, and the Emperor bows to no one', () => {
    const s = emptyGame('POR');
    expect(acceptance(s, 'FRA', 'ENG', 'vassalize').blocked).toMatch(/great crown/);
    expect(acceptance(s, 'BOH', 'HAB', 'vassalize').blocked).toMatch(/Emperor/);
    // A minor state can still be asked (it may say no, but it is not ruled out).
    expect(acceptance(s, 'FRA', 'BRI', 'vassalize').blocked ?? '').not.toMatch(/great crown/);
  });

  test('a great crown in a personal union keeps its own laws', () => {
    const s = emptyGame('POR');
    makeSubject(s, 'CAS', 'ARA', 'union');
    s.nations.ARA.subjectSince = s.day - years(60);
    expect(acceptance(s, 'CAS', 'ARA', 'annex').blocked).toMatch(/own laws/);
  });

  test('a capital costs double at the peace table', () => {
    const s = emptyGame('POR');
    const paris = s.regions.ile_de_france;
    expect(regionPeaceCost(s, 'ENG', 'ile_de_france')).toBe(Math.round(paris.dev * 3 * 2));
    expect(regionPeaceCost(s, 'ENG', 'orleans')).toBe(Math.max(3, Math.round(s.regions.orleans.dev * 3)));
  });

  test('the electors march to defend the Emperor against an outsider', () => {
    const s = emptyGame('POR');
    forceWar(s, 'HUN', 'HAB');
    const electors = s.hre.electors.filter(e => e !== 'BOH'); // Bohemia is Austria's ally anyway
    expect(likelySides(s, 'HUN', 'HAB').defenders).toEqual(expect.arrayContaining(electors));
    const w = declareWar(s, 'HUN', 'HAB', 'none')!;
    expect(w.defenders).toEqual(expect.arrayContaining(electors));
  });

  test('a crown weighing war counts distant allies for less, but the Empire’s sworn defenders in full', () => {
    const s = emptyGame('POR');
    forceWar(s, 'TUR', 'HAB');
    const sworn = imperialDefenders(s, 'TUR', 'HAB');
    const far = sworn.find(e => proximity(s, e, 'TUR') < 1)!;
    expect(far).toBeDefined();
    const full = militaryPower(s, 'HAB') + militaryPower(s, far);
    expect(sideStrength(s, ['HAB', far], 'HAB', 'TUR')).toBeLessThan(full);
    expect(sideStrength(s, ['HAB', far], 'HAB', 'TUR', sworn)).toBeCloseTo(full);
  });
});

describe('AI generals', () => {
  test('idle generals take the biggest armies; a skilled ruler leads only with an heir ready', () => {
    const s = emptyGame('POR');
    const fra = s.nations.FRA;
    fra.heir = undefined;
    fra.ruler = { ...fra.ruler, skill: 5, regency: false };
    const big = army(s, 'FRA', 'ile_de_france', 14);
    const mid = army(s, 'FRA', 'orleans', 9);
    const small = army(s, 'FRA', 'champagne', 3);
    const best = newGeneral(s, 'FRA', { stars: 3 });
    const other = newGeneral(s, 'FRA', { stars: 1 });
    fra.generals = [other, best];
    debugAI.aiGenerals(s, fra);
    expect(big.general?.id).toBe(best.id);
    expect(mid.general?.id).toBe(other.id);
    expect(small.general).toBeUndefined();
    expect(fra.generals).toEqual([]);
    // A new army bigger than all: with an heir ready, the king (4 stars) rides out with it.
    const host = army(s, 'FRA', 'ile_de_france', 20);
    fra.heir = { name: 'Louis', born: 1430, skill: 3, traits: [] };
    debugAI.aiGenerals(s, fra);
    expect(host.general?.isRuler).toBe(true);
    // The heir dies: the king comes home, and the big army takes the general of one less than half its size.
    fra.heir = undefined;
    debugAI.aiGenerals(s, fra);
    expect(host.general?.id).toBe(other.id);
    expect(mid.general).toBeUndefined();
    expect(big.general?.id).toBe(best.id);
  });

  test('at war, an army of 8+ regiments with no general gets one hired, at the price the player pays', () => {
    const s = emptyGame('POR');
    const fra = s.nations.FRA;
    fra.heir = undefined;
    fra.generals = [];
    const host = army(s, 'FRA', 'ile_de_france', 9);
    const band = army(s, 'FRA', 'orleans', 5);
    fra.gold = 1000;
    debugAI.aiGenerals(s, fra);
    expect(host.general).toBeUndefined(); // at peace: only for 10+ regiments
    host.regs.inf.n = 10;
    debugAI.aiGenerals(s, fra);
    expect(host.general).toBeDefined();
    host.general = undefined;
    host.regs.inf.n = 9;
    fra.gold = 1000;
    forceWar(s, 'FRA', 'BUR');
    declareWar(s, 'FRA', 'BUR', 'none');
    debugAI.aiGenerals(s, fra);
    expect(host.general).toBeDefined();
    expect(band.general).toBeUndefined();
    expect(fra.gold).toBe(1000 - GENERAL_COST);
    // Too poor: no.
    host.general = undefined;
    fra.gold = 10;
    debugAI.aiGenerals(s, fra);
    expect(host.general).toBeUndefined();
  });

  test('most of the AI big armies have a general', () => {
    const s = newGame({ player: 'POR', seed: 1 });
    s.flags.__spectate = 1;
    advanceDays(s, 365 * 16);
    const big = Object.values(s.armies).filter(a => a.owner !== 'REB' && armyRegs(a) >= 10);
    expect(big.length).toBeGreaterThan(10);
    expect(big.filter(a => a.general).length / big.length).toBeGreaterThan(0.5);
  }, 120000);
});
