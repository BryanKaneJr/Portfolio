import { emptyGame, forceWar } from './helpers';
import { acceptance } from '../src/sim/diplomacy';
import { declareWar, likelySides, regionPeaceCost } from '../src/sim/war';
import { makeSubject } from '../src/sim/territory';
import { years } from '../src/sim/util';

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
});
