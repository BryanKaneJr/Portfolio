import { army, emptyGame } from './helpers';
import { debugAI } from '../src/sim/ai';
import { SCENARIO, startingClaim } from '../src/sim/content';
import { migrateSave, SAVE_VERSION } from '../src/sim/state';
import { advanceDays } from '../src/sim/tick';
import { casusBelli, claimReason } from '../src/sim/war';
import { dayOf, yearOf, years } from '../src/sim/util';

describe('the claims of 1444', () => {
  test('each is on another crown’s land and lapses on 1 January of its year', () => {
    const s = emptyGame('CAS');
    for (const [n, list] of Object.entries(SCENARIO.claims))
      for (const c of list) {
        expect(s.regions[c.region].owner).not.toBe(n);
        expect(s.nations[n].claims[c.region]).toBe(dayOf(c.until, 0, 1));
        expect(c.until).toBeGreaterThan(yearOf(s.day));
      }
  });

  test('the reason for war names the quarrel and when it lapses', () => {
    const s = emptyGame('CAS');
    const cb = casusBelli(s, 'CAS', 'GRA').find(c => c.goal === 'granada')!;
    expect(cb.cb).toBe('claim');
    expect(cb.why).toBe('The Reconquista');
    expect(yearOf(cb.until!)).toBe(1500);
  });

  test('a claim forged or granted since has no story', () => {
    const s = emptyGame('CAS');
    s.nations.CAS.claims.granada = -1;
    expect(claimReason(s, 'CAS', 'granada')).toBeUndefined();
    expect(casusBelli(s, 'CAS', 'GRA').find(c => c.goal === 'granada')!.until).toBeUndefined();
  });

  test('a claim is gone once its year comes, and with it the reason for war', () => {
    const s = emptyGame('CAS');
    s.nations.CAS.claims.granada = s.day + 10;
    advanceDays(s, 45);
    expect('granada' in s.nations.CAS.claims).toBe(false);
    expect(casusBelli(s, 'CAS', 'GRA').some(c => c.cb === 'claim')).toBe(false);
  });

  test('an older save’s everlasting claims of 1444 lapse in their year, once', () => {
    const s = emptyGame('CAS');
    const old = JSON.parse(JSON.stringify(s));
    old.version = 5;
    old.day = dayOf(1472, 5, 1);
    old.nations.CAS.claims.granada = -1; // still to come: lapses in 1500
    old.nations.TUR.claims.constantinople = -1; // its year (1470) has passed
    old.nations.FRA.claims.london = -1; // never a claim of 1444: left alone
    const m = migrateSave(old)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.nations.CAS.claims.granada).toBe(dayOf(1500, 0, 1));
    expect('constantinople' in m.nations.TUR.claims).toBe(false);
    expect(m.nations.FRA.claims.london).toBe(-1);
    // A claim granted for ever after the update is not cut short on the next load.
    m.nations.CAS.claims.granada = -1;
    expect(migrateSave(JSON.parse(JSON.stringify(m)))!.nations.CAS.claims.granada).toBe(-1);
  });

  test('the first wars come one by one: each crown made peace at some time in the three years before', () => {
    const s = emptyGame('CAS');
    const rests = Object.values(s.nations).map(n => s.day - n.ai.lastPeace!);
    for (const r of rests) expect(r >= 0 && r <= years(3)).toBe(true);
    expect(new Set(rests).size).toBeGreaterThan(rests.length / 2);
  });

  test('an ambitious crown with no reason for war forges one instead of marching', () => {
    const s = emptyGame('POR');
    const fra = s.nations.FRA;
    fra.claims = {};
    fra.rivals = [];
    fra.gold = 1000;
    fra.ai.lastPeace = s.day - years(10);
    army(s, 'FRA', fra.capital, 60, 20, 10);
    for (let i = 0; i < 100 && !fra.fabricating; i++) debugAI.aiWar(s, fra);
    expect(Object.values(s.wars).some(w => w.attackers.includes('FRA'))).toBe(false);
    expect(fra.fabricating).toBeTruthy();
    const target = s.regions[fra.fabricating!.region].owner!;
    expect(target).not.toBe('FRA');
    // A year on, with its claim, it goes to war for that region.
    fra.claims[fra.fabricating!.region] = s.day + years(25);
    fra.fabricating = undefined;
    for (let i = 0; i < 100 && !Object.keys(s.wars).length; i++) debugAI.aiWar(s, fra);
    const w = Object.values(s.wars).find(x => x.attackers[0] === 'FRA');
    expect(w?.cb).toBe('claim');
  });

  test('the list stays short: no crown starts with more than four', () => {
    for (const list of Object.values(SCENARIO.claims)) expect(list.length).toBeLessThanOrEqual(4);
    expect(startingClaim('CAS', 'granada')?.until).toBe(1500);
  });
});
