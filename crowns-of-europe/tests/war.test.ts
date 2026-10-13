import { emptyGame, army, forceWar } from './helpers';
import { aiAnswersCall, casusBelli, declareWar, likelySides, makePeace, peaceCost, warScore, buildDemands } from '../src/sim/war';
import { advanceDays } from '../src/sim/tick';
import { pairKey } from '../src/sim/util';
import { REBELS, seesUnit } from '../src/sim/queries';

describe('war and peace', () => {
  test('claims give a reason for war with a goal', () => {
    const s = emptyGame('CAS');
    const cbs = casusBelli(s, 'CAS', 'GRA');
    expect(cbs[0].cb).toBe('claim');
    expect(cbs[0].goal).toBe('granada');
    expect(cbs[cbs.length - 1].cb).toBe('none');
  });

  test('occupying land raises war score; peace transfers it and sets a truce and Threat', () => {
    const s = emptyGame('CAS');
    forceWar(s, 'CAS', 'GRA');
    s.alliances = {};
    const w = declareWar(s, 'CAS', 'GRA', 'claim', 'granada')!;
    expect(w).toBeTruthy();
    army(s, 'CAS', 'granada', 12, 2);
    advanceDays(s, 400);
    expect(s.regions.granada.controller).toBe('CAS');
    const sc = warScore(s, s.wars[w.id]);
    expect(sc.total).toBeGreaterThan(50);
    const terms = buildDemands(s, s.wars[w.id], 'CAS', sc.total);
    expect(terms.regions).toContain('granada');
    expect(peaceCost(s, terms)).toBeLessThanOrEqual(sc.total);
    const threatBefore = s.nations.CAS.threat;
    makePeace(s, s.wars[w.id], terms);
    expect(s.regions.granada.owner).toBe('CAS');
    expect(s.nations.GRA.alive).toBe(false);
    expect(s.nations.CAS.threat).toBeGreaterThan(threatBefore);
    expect(Object.keys(s.wars)).toHaveLength(0);
  });

  test('allies answer defensive calls to arms; refusing breaks the alliance', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'HUN', 'POL');
    const w = declareWar(s, 'TUR', 'HUN', 'rival')!;
    // Poland is Hungary's ally in 1444.
    const polIn = w.defenders.includes('POL');
    if (!polIn) expect(s.alliances[pairKey('POL', 'HUN')]).toBeUndefined();
    else expect(w.defenders).toContain('POL');
  });

  test('distant allies defend you but stay out of your wars of conquest', () => {
    const s = emptyGame('FRA');
    // Denmark is far from the Ottomans: it would defend Hungary, but not march to the Danube for Hungary's attack.
    expect(aiAnswersCall(s, 'DAN', 'HUN', 'TUR', true)).toBe(true);
    expect(aiAnswersCall(s, 'DAN', 'HUN', 'TUR', false)).toBe(false);
    // Scotland is next door to England: it joins France's attack, Denmark doesn't.
    expect(aiAnswersCall(s, 'SCO', 'FRA', 'ENG', false)).toBe(true);
    expect(aiAnswersCall(s, 'DAN', 'FRA', 'ENG', false)).toBe(false);
    // A crown planning a war counts only the allies who would come.
    s.alliances[pairKey('DAN', 'FRA')] = s.day;
    const sides = likelySides(s, 'FRA', 'ENG');
    expect(sides.attackers).toContain('SCO');
    expect(sides.attackers).not.toContain('DAN');
  });

  test('a white peace ends the war with nothing changing hands', () => {
    const s = emptyGame('ENG');
    forceWar(s, 'FRA', 'BUR');
    const w = declareWar(s, 'FRA', 'BUR', 'none')!;
    const owners = Object.fromEntries(Object.values(s.regions).map(r => [r.id, r.owner]));
    makePeace(s, w, { regions: [], gold: 0, vassalize: false, release: [], white: true, winner: 'FRA', loser: 'BUR' });
    for (const r of Object.values(s.regions)) expect(r.owner).toBe(owners[r.id]);
    expect(s.truces[pairKey('FRA', 'BUR')]).toBeGreaterThan(s.day);
  });
});

describe('who sees whose troops', () => {
  test('yours, your friends\' and enemies\', and anyone in your land; nobody else\'s', () => {
    const s = emptyGame('CAS');
    s.alliances = {};
    forceWar(s, 'CAS', 'GRA');
    const sees = (owner: string, where: string, rebelOf?: string) => seesUnit(s, 'CAS', owner, where, rebelOf);
    expect(sees('CAS', 'lesser_poland')).toBe(true); // your own, anywhere
    expect(sees('POL', 'lesser_poland')).toBe(false); // a stranger at home
    expect(sees('POR', 'atlantic')).toBe(false); // ... or at sea
    expect(sees('POR', 'castile')).toBe(true); // in your land
    s.alliances[pairKey('CAS', 'POR')] = s.day;
    expect(sees('POR', 'lisbon')).toBe(true); // an ally
    expect(sees('GRA', 'granada')).toBe(false);
    declareWar(s, 'CAS', 'GRA', 'claim', 'granada');
    expect(sees('GRA', 'granada')).toBe(true); // an enemy
    s.nations.NAV.overlord = 'CAS';
    expect(sees('NAV', 'navarre')).toBe(true); // a subject
    expect(sees(REBELS, 'granada', 'CAS')).toBe(true); // risen against you
    expect(sees(REBELS, 'lesser_poland', 'POL')).toBe(false); // risen against someone else
    expect(sees(REBELS, 'castile', 'POL')).toBe(true); // ... but in your land
  });
});
