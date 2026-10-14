import { warOdds } from '../src/sim/ai';
import { newGame } from '../src/sim/state';
import { diplomaticTies } from '../src/sim/ties';
import { yearOf, years } from '../src/sim/util';

describe('the ties between crowns, for the Diplomacy tab', () => {
  test('France’s claims on the English, and England sees them', () => {
    const s = newGame({ player: 'FRA', seed: 1 });
    const fra = diplomaticTies(s, 'FRA');
    for (const r of ['normandy', 'gascony', 'calais']) {
      const c = fra.yourClaims.find(x => x.region === r)!;
      expect(c.holder).toBe('ENG');
      expect(yearOf(c.until)).toBe(1475);
      expect(c.why).toBe('The Hundred Years’ War');
    }
    const eng = diplomaticTies(s, 'ENG');
    for (const r of ['normandy', 'gascony', 'calais']) expect(eng.claimsOnYou.some(c => c.by === 'FRA' && c.region === r)).toBe(true);
    expect(fra.claimsOnYou.some(c => c.by === 'FRA')).toBe(false);
  });

  test('a claim on a subject’s land is on the overlord, and a subject sees its overlord', () => {
    const s = newGame({ player: 'TUR', seed: 1 });
    const tur = diplomaticTies(s, 'TUR');
    expect(tur.claimsOnYou).toContainEqual(expect.objectContaining({ by: 'HUN', region: 'serbia', holder: 'SER', why: 'The Hungarian crusades' }));
    expect(tur.claimsOnYou.every(c => c.holder === 'TUR' || s.nations[c.holder!].overlord === 'TUR')).toBe(true);
    expect(diplomaticTies(s, 'SER').overlord).toEqual({ nation: 'TUR', union: false });
    expect(diplomaticTies(s, 'SER').claimsOnYou.some(c => c.by === 'HUN' && c.region === 'serbia')).toBe(true);
    expect(diplomaticTies(s, 'SWE').overlord).toEqual({ nation: 'DAN', union: true });
  });

  test('a lapsed claim, a dead crown and an ended truce are gone', () => {
    const s = newGame({ player: 'FRA', seed: 1 });
    s.nations.FRA.claims.normandy = s.day;
    expect(diplomaticTies(s, 'FRA').yourClaims.some(c => c.region === 'normandy')).toBe(false);
    expect(diplomaticTies(s, 'ENG').claimsOnYou.some(c => c.region === 'normandy')).toBe(false);
    expect(diplomaticTies(s, 'FRA').truces.map(t => t.nation)).toContain('ENG');
    s.nations.ENG.alive = false;
    expect(diplomaticTies(s, 'FRA').truces.map(t => t.nation)).not.toContain('ENG');
    s.nations.ENG.alive = true;
    s.day = s.truces['ENG|FRA'];
    expect(diplomaticTies(s, 'FRA').truces.map(t => t.nation)).not.toContain('ENG');
  });

  test('truces, marriages, alliances and old friends as the scenario has them', () => {
    const s = newGame({ player: 'POR', seed: 1 });
    const fra = diplomaticTies(s, 'FRA');
    expect(fra.truces.map(t => [t.nation, yearOf(t.until)])).toContainEqual(['ENG', 1448]);
    expect(fra.allies).toEqual(expect.arrayContaining(['SCO', 'CAS']));
    expect(fra.marriages).toEqual(expect.arrayContaining(['CAS', 'SCO', 'ENG']));
    expect(fra.oldFriends).toContainEqual({ nation: 'SCO', label: 'The Auld Alliance' });
    const por = diplomaticTies(s, 'POR');
    expect(por.marriages).toEqual(expect.arrayContaining(['BUR', 'HAB']));
    expect(por.allies).toContain('ENG');
    expect(por.oldFriends.map(b => b.nation)).toContain('ENG');
    expect(por.yourClaims.map(c => c.region)).toContain('fez');
  });

  test('military access both ways, lapsing ten years on', () => {
    const s = newGame({ player: 'POR', seed: 1 });
    s.access['CAS>POR'] = s.day;
    expect(diplomaticTies(s, 'POR').accessYouHave).toEqual([{ nation: 'CAS', until: s.day + years(10) }]);
    expect(diplomaticTies(s, 'POR').accessYouGive).toEqual([]);
    expect(diplomaticTies(s, 'CAS').accessYouGive).toEqual([{ nation: 'POR', until: s.day + years(10) }]);
  });

  test('rivals both ways', () => {
    const s = newGame({ player: 'POR', seed: 1 });
    s.nations.CAS.rivals = ['POR'];
    s.nations.POR.rivals = ['ARA'];
    const por = diplomaticTies(s, 'POR');
    expect(por.rivalsOfYou).toContain('CAS');
    expect(por.rivalsYouNamed).toEqual(['ARA']);
  });

  test('a forged claim in progress', () => {
    const s = newGame({ player: 'POR', seed: 1 });
    s.nations.POR.fabricating = { region: 'fez', done: s.day + 100 };
    expect(diplomaticTies(s, 'POR').forging).toEqual({ region: 'fez', holder: s.regions.fez.owner, done: s.day + 100 });
  });

  test('Castile, rested, could march on Granada; and France waits out its truce with England', () => {
    const s = newGame({ player: 'GRA', seed: 1 });
    s.nations.CAS.ai.lastPeace = s.day - years(10);
    const odds = warOdds(s, 'CAS');
    const gra = diplomaticTies(s, 'GRA');
    const cas = gra.couldAttack.find(t => t.nation === 'CAS')!;
    expect(cas).toBeDefined();
    expect(cas.monthly).toBe(odds.monthly);
    expect(cas.monthly).toBeGreaterThan(0);
    expect(gra.claimsOnYou).toContainEqual(expect.objectContaining({ by: 'CAS', region: 'granada', why: 'The Reconquista' }));

    const e = newGame({ player: 'ENG', seed: 1 });
    e.nations.FRA.ai.lastPeace = e.day - years(10);
    const truce = e.truces['ENG|FRA'];
    e.day = truce - years(1.5);
    const fra = diplomaticTies(e, 'ENG').couldAttack.find(t => t.nation === 'FRA')!;
    expect(fra.waitingUntil).toBe(truce);
    expect(fra.monthly).toBe(0);
  });

  test('a resting crown with a claim on your land shows when its rest ends', () => {
    const s = newGame({ player: 'BYZ', seed: 1 });
    s.nations.TUR.ai.lastPeace = s.day;
    const odds = warOdds(s, 'TUR');
    expect(odds.blocked).toBe('rest');
    const tur = diplomaticTies(s, 'BYZ').couldAttack.find(t => t.nation === 'TUR')!;
    expect(tur).toEqual({ nation: 'TUR', monthly: 0, restingUntil: odds.restUntil });
  });

  test('pure: no draws', () => {
    const s = newGame({ player: 'GRA', seed: 1 });
    const r0 = s.rng;
    diplomaticTies(s, 'GRA');
    diplomaticTies(s, 'FRA');
    expect(s.rng).toBe(r0);
  });
});
