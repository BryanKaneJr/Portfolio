import { emptyGame, army } from './helpers';
import { ADVANCES } from '../src/sim/content';
import { maxManpower, monthlyEconomy, regionTax } from '../src/sim/economy';
import { REBELS, bumpOwnership, bumpWars, invalidateMods, nationMods, ownedRegions } from '../src/sim/queries';
import { monthlyUnrest, unrestBreakdown } from '../src/sim/rebels';
import {
  COUNTS,
  GOLDEN,
  aiRealm,
  crackDown,
  crackdownBlocked,
  crackdownCost,
  goldenChecks,
  monthlyGolden,
  proclaimGoldenAge,
  seizeBlocked,
  seizeEstates,
  seizeGold,
} from '../src/sim/realm';
import { canAbdicate, rulerAsGeneral } from '../src/sim/rulers';
import { abdicateRuler, crackDownOn, proclaimGolden, seizeTheEstates } from '../src/sim/commands';
import type { GameState, NationId } from '../src/sim/types';
import { months, sum, yearOf, years } from '../src/sim/util';

/** A region of `n`'s, held by it, with some prosperity. */
function regionOf(s: GameState, n: NationId, minDev = 2) {
  return ownedRegions(s, n).find(r => r.controller === n && r.dev >= minDev)!;
}

describe('crack down', () => {
  test('costs 500 levies a point of prosperity, at least 1,000', () => {
    const s = emptyGame('CAS');
    const r = regionOf(s, 'CAS');
    r.dev = 6;
    expect(crackdownCost(r)).toBe(3000);
    r.dev = 1;
    expect(crackdownCost(r)).toBe(1000);
  });

  test('−3 unrest for 5 years, shown in the breakdown, paid in levies', () => {
    const s = emptyGame('CAS');
    const r = regionOf(s, 'CAS');
    r.dev = 6;
    r.unrestMods.push({ amount: 5, until: s.day + years(3) });
    r.unrest = 5;
    const nat = s.nations.CAS;
    nat.manpower = 10000;
    expect(crackDownOn(s, r.id).ok).toBe(true);
    expect(nat.manpower).toBe(7000);
    const line = unrestBreakdown(s, r).find(p => p.label === 'Crackdown');
    expect(line?.value).toBe(-3);
    expect(r.unrestMods.find(m => m.why === 'Crackdown')?.until).toBe(s.day + years(5));
    // The sheet updates at once.
    expect(r.unrest).toBeCloseTo(Math.max(0, sum(unrestBreakdown(s, r), p => p.value)), 5);
    // Not twice at once.
    expect(crackdownBlocked(s, 'CAS', r.id)).toMatch(/^Crackdown until /);
    expect(crackDown(s, 'CAS', r.id)).toBe(false);
  });

  test('refused with no unrest, when occupied, or short of levies', () => {
    const s = emptyGame('CAS');
    const r = regionOf(s, 'CAS');
    s.nations.CAS.manpower = 50000;
    r.unrest = 0.5;
    expect(crackdownBlocked(s, 'CAS', r.id)).toBe('No unrest to put down');
    r.unrest = 4;
    expect(crackdownBlocked(s, 'CAS', r.id)).toBeNull();
    r.controller = 'POR';
    expect(crackdownBlocked(s, 'CAS', r.id)).toBe('The region is occupied');
    r.controller = 'CAS';
    s.nations.CAS.manpower = crackdownCost(r) - 1;
    expect(crackdownBlocked(s, 'CAS', r.id)).toMatch(/^Needs .* levies$/);
    expect(crackdownBlocked(s, 'POR', r.id)).toBe('Not your region');
  });
});

describe('seize estates', () => {
  test('a year of taxes at once; order −1; +2 unrest in every region for 5 years; once in 10 years', () => {
    const s = emptyGame('FRA');
    const nat = s.nations.FRA;
    nat.stability = 1;
    const expected = Math.round(12 * sum(ownedRegions(s, 'FRA'), r => regionTax(s, r)));
    expect(expected).toBeGreaterThan(0);
    expect(seizeGold(s, 'FRA')).toBe(expected);
    const gold = nat.gold;
    const res = seizeTheEstates(s);
    expect(res.ok).toBe(true);
    expect(res.msg).toContain('seize the estates');
    expect(nat.gold).toBe(gold + expected);
    expect(nat.stability).toBe(0);
    for (const r of ownedRegions(s, 'FRA')) {
      const m = r.unrestMods.find(x => x.why === 'Estates seized');
      expect(m).toEqual({ amount: 2, until: s.day + years(5), why: 'Estates seized' });
      expect(unrestBreakdown(s, r).find(p => p.label === 'Estates seized')?.value).toBe(2);
    }
    expect(seizeBlocked(s, 'FRA')).toBe(`Seize estates again in ${yearOf(s.day + years(10))}`);
    expect(seizeEstates(s, 'FRA')).toBeNull();
    s.day += years(10);
    expect(seizeBlocked(s, 'FRA')).toBeNull();
  });

  test('refused at order −2', () => {
    const s = emptyGame('FRA');
    s.nations.FRA.stability = -2;
    expect(seizeBlocked(s, 'FRA')).toBe('Order too low');
    s.nations.FRA.stability = -1;
    expect(seizeBlocked(s, 'FRA')).toBeNull();
  });
});

describe('abdicate', () => {
  test('each reason it is refused', () => {
    const s = emptyGame('ENG');
    const eng = s.nations.ENG;
    // Henry VI (born 1421) has reigned since 1444 (no crowning day: read as day 0).
    expect(canAbdicate(s, 'ENG')).toBe('Reigned under 10 years');
    eng.ruler.born = 1444 - 50;
    expect(canAbdicate(s, 'ENG')).toBeNull();
    eng.ruler.born = 1421;
    s.day = years(10) + 1;
    expect(canAbdicate(s, 'ENG')).toBeNull();
    eng.ruler.regency = true;
    expect(canAbdicate(s, 'ENG')).toBe('A regent rules');
    eng.ruler.regency = false;
    const heir = eng.heir!;
    eng.heir = { ...heir, born: yearOf(s.day) - 10 };
    expect(canAbdicate(s, 'ENG')).toBe('Your heir is a child');
    eng.heir = undefined;
    expect(canAbdicate(s, 'ENG')).toBe('No heir');
    expect(canAbdicate(s, 'VEN')).toBe('Only a crowned monarch can step down');
    expect(abdicateRuler(s).ok).toBe(false);
  });

  test('the heir takes the throne today: order −1, renown −10, the old ruler leaves his army', () => {
    const s = emptyGame('ENG');
    s.day = years(12);
    const eng = s.nations.ENG;
    eng.stability = 1;
    eng.prestige = 30;
    const heir = eng.heir!;
    const a = army(s, 'ENG', 'london', 4);
    a.general = rulerAsGeneral(s, 'ENG');
    const moments = s.moments?.length ?? 0;
    expect(abdicateRuler(s).ok).toBe(true);
    expect(eng.ruler.name).toBe(heir.name);
    expect(eng.ruler.crowned).toBe(s.day);
    expect(eng.heir).toBeUndefined();
    expect(eng.stability).toBe(0);
    expect(eng.prestige).toBe(20);
    expect(a.general).toBeUndefined();
    const m = s.moments![s.moments!.length - 1];
    expect(s.moments!.length).toBe(moments + 1);
    expect(m.kind).toBe('ruler');
    // The new ruler has just been crowned: not again for 10 years.
    eng.heir = { ...heir, name: 'Edward', born: 1420 };
    expect(canAbdicate(s, 'ENG')).toBe('Reigned under 10 years');
  });
});

describe('golden age', () => {
  function ready(s: GameState, n: NationId) {
    const nat = s.nations[n];
    nat.prestige = GOLDEN.renown;
    nat.stability = GOLDEN.order;
    nat.advances = ADVANCES.slice(0, GOLDEN.advances).map(a => a.id);
    s.wars = {};
    bumpWars();
    invalidateMods();
  }

  test('the four checks', () => {
    const s = emptyGame('FRA');
    ready(s, 'FRA');
    expect(goldenChecks(s, 'FRA').every(c => c.ok)).toBe(true);
    s.nations.FRA.prestige = GOLDEN.renown - 1;
    expect(goldenChecks(s, 'FRA').map(c => c.ok)).toEqual([false, true, true, true]);
    ready(s, 'FRA');
    s.nations.FRA.stability = 0;
    expect(goldenChecks(s, 'FRA')[1].ok).toBe(false);
    ready(s, 'FRA');
    s.nations.FRA.advances.pop();
    expect(goldenChecks(s, 'FRA')[3].ok).toBe(false);
    expect(proclaimGolden(s).ok).toBe(false);
  });

  test('proclaimed: the bonuses, a card for the player, once a game, ending after 50 years', () => {
    const s = emptyGame('FRA');
    ready(s, 'FRA');
    const before = { ...nationMods(s, 'FRA') };
    expect(proclaimGolden(s).ok).toBe(true);
    const nat = s.nations.FRA;
    expect(nat.golden).toEqual({ since: s.day, until: s.day + years(50) });
    const after = nationMods(s, 'FRA');
    expect(after.taxIncome - before.taxIncome).toBeCloseTo(0.1);
    expect(after.devCost - before.devCost).toBeCloseTo(-0.1);
    expect(after.manpower - before.manpower).toBeCloseTo(0.1);
    expect(after.unrest - before.unrest).toBeCloseTo(-1);
    const m = s.moments![s.moments!.length - 1];
    expect(m).toMatchObject({ kind: 'golden', card: true, tone: 'good', title: 'A Golden Age for France' });
    expect(m.lines?.[2]).toBe(`Until ${yearOf(s.day + years(50))}.`);
    // Once a game.
    expect(proclaimGolden(s).ok).toBe(false);
    expect(proclaimGoldenAge(s, 'FRA')).toBe(false);
    // Fifty years on, the bonuses are gone and the memory stays.
    s.day += years(50) + 1;
    monthlyEconomy(s);
    monthlyGolden(s);
    invalidateMods();
    expect(nat.modifiers.some(x => x.id === 'golden_age')).toBe(false);
    expect(nationMods(s, 'FRA').taxIncome).toBeCloseTo(before.taxIncome);
    expect(nat.golden?.over).toBe(true);
    expect(s.log.some(l => l.text === 'Your golden age ends. It will be remembered.')).toBe(true);
    expect(s.moments![s.moments!.length - 1]).toMatchObject({ kind: 'golden', card: false, title: 'The golden age ends' });
    const logs = s.log.length;
    monthlyGolden(s);
    expect(s.log.length).toBe(logs);
    expect(proclaimGoldenAge(s, 'FRA')).toBe(false);
  });

  test('not for a New World people, nor at war', () => {
    const s = emptyGame('FRA');
    ready(s, 'AZT');
    expect(proclaimGoldenAge(s, 'AZT')).toBe(false);
    ready(s, 'ENG');
    s.wars = { w1: { id: 'w1', name: 'Test', attackers: ['ENG'], defenders: ['SCO'], cb: 'none', started: 0, battleScore: 0, goalScore: 0 } };
    bumpWars();
    expect(goldenChecks(s, 'ENG')[2].ok).toBe(false);
    expect(proclaimGoldenAge(s, 'ENG')).toBe(false);
  });
});

describe('aiRealm', () => {
  /** An AI crown that would do nothing at all this month. */
  function quiet(s: GameState, n: NationId) {
    const nat = s.nations[n];
    nat.prestige = 0;
    nat.loans = 0;
    nat.stability = 0;
    nat.ruler.skill = 3;
    for (const r of ownedRegions(s, n)) r.unrest = 0;
    return nat;
  }

  test('cracks down above unrest 6 with levies over half full', () => {
    const s = emptyGame('FRA');
    const nat = quiet(s, 'ARA');
    const r = regionOf(s, 'ARA');
    nat.manpower = maxManpower(s, 'ARA');
    r.unrest = 6;
    aiRealm(s, nat);
    expect(r.unrestMods.some(m => m.why === 'Crackdown')).toBe(false);
    nat.manpower = maxManpower(s, 'ARA') * 0.4;
    r.unrest = 8;
    aiRealm(s, nat);
    expect(r.unrestMods.some(m => m.why === 'Crackdown')).toBe(false);
    nat.manpower = maxManpower(s, 'ARA');
    const before = COUNTS.crackdowns;
    aiRealm(s, nat);
    expect(r.unrestMods.some(m => m.why === 'Crackdown')).toBe(true);
    expect(COUNTS.crackdowns).toBe(before + 1);
  });

  test('seizes the estates at 3 loans with order 0 or better', () => {
    const s = emptyGame('FRA');
    const nat = quiet(s, 'ARA');
    nat.loans = 2;
    const gold = nat.gold;
    aiRealm(s, nat);
    expect(nat.gold).toBe(gold);
    nat.loans = 3;
    nat.stability = -1;
    aiRealm(s, nat);
    expect(nat.gold).toBe(gold);
    nat.stability = 0;
    aiRealm(s, nat);
    expect(nat.gold).toBeGreaterThan(gold);
    expect(nat.stability).toBe(-1);
  });

  test('a poor ruler steps down for a much better grown heir', () => {
    const s = emptyGame('FRA');
    s.day = years(11);
    const nat = quiet(s, 'ARA');
    nat.ruler.skill = 2;
    nat.heir = { name: 'Ferdinand', born: 1420, skill: 3, traits: [] };
    aiRealm(s, nat);
    expect(nat.ruler.skill).toBe(2);
    nat.heir.skill = 4;
    aiRealm(s, nat);
    expect(nat.ruler.name).toBe('Ferdinand');
    expect(nat.ruler.crowned).toBe(s.day);
  });

  test('proclaims a golden age as soon as it may, with a banner for news', () => {
    const s = emptyGame('FRA');
    const nat = quiet(s, 'ARA');
    aiRealm(s, nat);
    expect(nat.golden).toBeUndefined();
    nat.prestige = 45;
    nat.stability = 1;
    nat.advances = ADVANCES.slice(0, 4).map(a => a.id);
    s.wars = {};
    bumpWars();
    aiRealm(s, nat);
    expect(nat.golden?.since).toBe(s.day);
    expect(COUNTS.golden.some(g => g.n === 'ARA')).toBe(true);
    // Someone else's golden age is never a card.
    expect((s.moments ?? []).every(m => !(m.kind === 'golden' && m.card))).toBe(true);
  });
});

describe('rebels restoring a fallen crown', () => {
  test('a crown that loses its last region to them is gone', () => {
    const s = emptyGame('FRA');
    for (const r of ownedRegions(s, 'GEO')) if (r.id !== 'imereti') r.owner = r.controller = 'QAR';
    bumpOwnership();
    s.nations.GEO.capital = 'imereti';
    s.nations.AKK.alive = false;
    const r = s.regions.imereti;
    r.cores = ['GEO', 'AKK'];
    r.controller = REBELS;
    s.nations.GEO.flags._rebelheld_imereti = s.day - months(13);
    monthlyUnrest(s);
    expect(r.owner).toBe('AKK');
    expect(s.nations.AKK.alive).toBe(true);
    expect(s.nations.GEO.alive).toBe(false);
  });
});
