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
    expect(sees(REBELS, 'navarre', 'NAV')).toBe(true); // risen against a subject of yours
    expect(seesUnit(s, 'NAV', REBELS, 'granada', 'CAS')).toBe(true); // ... or against your overlord
  });
});

// ---------------------------------------------------------------- the AI at war: forecasts, gathering, endings

describe('the AI at war', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { forecast } = require('../src/sim/forecast') as typeof import('../src/sim/forecast');
  const { attackOdds, debugAI } = require('../src/sim/ai') as typeof import('../src/sim/ai');
  const { newGeneral } = require('../src/sim/rulers') as typeof import('../src/sim/rulers');
  const { pathTree } = require('../src/sim/military') as typeof import('../src/sim/military');
  const { ownedRegions } = require('../src/sim/queries') as typeof import('../src/sim/queries');
  const { newGame } = require('../src/sim/state') as typeof import('../src/sim/state');
  const { advanceDay } = require('../src/sim/tick') as typeof import('../src/sim/tick');
  const { years } = require('../src/sim/util') as typeof import('../src/sim/util');
  /* eslint-enable @typescript-eslint/no-require-imports */
  type GameState = import('../src/sim/types').GameState;

  /** Castile at war with Granada, nobody else on the map. */
  const granadaWar = () => {
    const s = emptyGame('POR');
    s.alliances = {};
    forceWar(s, 'CAS', 'GRA');
    declareWar(s, 'CAS', 'GRA', 'none');
    return s;
  };
  const ends = (s: GameState, id: string) => {
    const a = s.armies[id];
    return a.path.length ? a.path[a.path.length - 1] : a.node;
  };

  test('the forecast plays out the real battle: terrain, the front, generals and morale', () => {
    const s = granadaWar();
    const cas = army(s, 'CAS', 'andalusia', 20);
    const gra = army(s, 'GRA', 'granada', 15);
    for (const a of [cas, gra]) a.morale = 2.5;
    // In the mountains, 20 regiments against 15 are about even...
    const even = forecast(s, [cas], [gra], 'granada', 'andalusia');
    expect(even.ratio).toBeGreaterThan(0.9);
    expect(even.ratio).toBeLessThan(1.4);
    // ... and a 4-star general turns it into a defeat.
    gra.general = newGeneral(s, 'GRA', { stars: 4 });
    const lost = forecast(s, [cas], [gra], 'granada', 'andalusia');
    expect(lost.winner).toBe(1);
    expect(lost.ratio).toBeLessThan(0.7);
    // On open ground (the same armies, no general) the bigger army wins clearly, and fast.
    gra.general = undefined;
    const plains = forecast(s, [cas], [gra], 'andalusia');
    expect(plains.winner).toBe(0);
    expect(plains.ratio).toBeGreaterThan(1.5);
    expect(plains.days).toBeLessThan(even.days);
    // A huge stack expects to annihilate a small one; a shaken army (low morale) fights worse.
    const tiny = army(s, 'GRA', 'granada', 3);
    tiny.morale = 2.5;
    expect(forecast(s, [cas], [tiny], 'andalusia').wipeRisk).toBe(1);
    cas.morale = 0.8;
    expect(forecast(s, [cas], [gra], 'andalusia').ratio).toBeLessThan(plains.ratio);
  });

  test('the forecast picks the winner of the dice-rolled battle', () => {
    let agree = 0;
    const runs = 24;
    for (let i = 0; i < runs; i++) {
      const s = newGame({ player: 'POR', seed: 1000 + i });
      s.armies = {};
      s.fleets = {};
      s.flags.__noAI = 1;
      s.flags.__noEvents = 1;
      s.alliances = {};
      forceWar(s, 'CAS', 'GRA');
      declareWar(s, 'CAS', 'GRA', 'none');
      const cas = army(s, 'CAS', 'andalusia', 20, i % 3);
      const gra = army(s, 'GRA', 'granada', 15);
      if (i % 2) gra.general = newGeneral(s, 'GRA', { stars: 4 });
      advanceDay(s); // morale settles at its maximum
      const f = forecast(s, [cas], [gra], 'granada', 'andalusia');
      cas.path = ['granada'];
      for (let d = 0; d < 120 && !s.reports.length; d++) advanceDay(s);
      if (s.reports[0]?.winner === f.winner) agree++;
    }
    expect(agree / runs).toBeGreaterThanOrEqual(0.75);
  });

  test('the AI attacks only fights the forecast gives it: 35 regiments into 15, not into 15 and a great general in the mountains', () => {
    const s = granadaWar();
    const cas = army(s, 'CAS', 'andalusia', 35);
    const gra = army(s, 'GRA', 'granada', 15);
    for (const a of [cas, gra]) a.morale = 2.5;
    debugAI.armyAI(s, cas);
    expect(ends(s, cas.id)).toBe('granada');
    cas.path = [];
    const clear = attackOdds(s, [cas], gra, 'andalusia').ratio;
    gra.general = newGeneral(s, 'GRA', { stars: 4 });
    // The great general turns a clear win into a close call at best.
    expect(attackOdds(s, [cas], gra, 'andalusia').ratio).toBeLessThan(clear * 0.6);
    debugAI.armyAI(s, cas);
    // It neither attacks nor walks in to besiege the guarded city.
    expect(ends(s, cas.id)).not.toBe('granada');
  });

  test('stacks standing together join up for a fight only when it needs them both', () => {
    const s = granadaWar();
    const a = army(s, 'CAS', 'andalusia', 18);
    const b = army(s, 'CAS', 'andalusia', 18);
    const gra = army(s, 'GRA', 'granada', 15);
    for (const x of [a, b, gra]) x.morale = 2.5;
    // 18 against 15 in the mountains is no fight; 36 is.
    debugAI.armyAI(s, a);
    expect(s.armies[b.id]).toBeUndefined();
    expect(ends(s, a.id)).toBe('granada');
    expect(a.regs.inf.n).toBe(36);
    // Against a small garrison each stack is enough alone, and they stay two.
    const s2 = granadaWar();
    const c = army(s2, 'CAS', 'andalusia', 18);
    const d = army(s2, 'CAS', 'andalusia', 18);
    const few = army(s2, 'GRA', 'granada', 5);
    for (const x of [c, d, few]) x.morale = 2.5;
    debugAI.armyAI(s2, c);
    expect(s2.armies[d.id]).toBeDefined();
    expect(ends(s2, c.id)).toBe('granada');
  });

  test('recruits far weaker than the enemy stack in reach join a bigger army instead of walking out alone', () => {
    const s = emptyGame('POR');
    s.alliances = {};
    forceWar(s, 'BUR', 'FRA');
    declareWar(s, 'BUR', 'FRA', 'none');
    const recruits = army(s, 'BUR', 'burgundy', 3);
    recruits.morale = 2.5;
    // The French army stands three to six weeks' march away: out of the danger range, within reach.
    const tree = pathTree(s, recruits, { maxDays: 90 });
    const far = ownedRegions(s, 'FRA').find(r => (tree.dist.get(r.id) ?? 0) > 22 && (tree.dist.get(r.id) ?? 99) < 38)!;
    expect(far).toBeDefined();
    army(s, 'FRA', far.id, 25).morale = 2.5;
    // Alone, it waits.
    debugAI.armyAI(s, recruits);
    expect(s.armies[recruits.id].path).toEqual([]);
    // A bigger army of ours far off is no reason to leave its land open...
    const away = ownedRegions(s, 'BUR').find(r => (tree.dist.get(r.id) ?? 0) > 24 && (tree.dist.get(r.id) ?? 99) < 40)!;
    const distant = army(s, 'BUR', away.id, 15);
    distant.morale = 2.5;
    debugAI.armyAI(s, recruits);
    expect(s.armies[recruits.id].path).toEqual([]);
    // ... one close by, it marches to join.
    const home = ownedRegions(s, 'BUR').find(r => r.id !== 'burgundy' && (tree.dist.get(r.id) ?? 99) < 20)!;
    const main = army(s, 'BUR', home.id, 15);
    main.morale = 2.5;
    debugAI.armyAI(s, recruits);
    expect(ends(s, recruits.id)).toBe(main.node);
  });

  test("a winner may take a far-off realm's last region, or make a small realm its vassal", () => {
    const s = emptyGame('POR');
    s.alliances = {};
    forceWar(s, 'VEN', 'KNI');
    const w = declareWar(s, 'VEN', 'KNI', 'none')!;
    // Rhodes is an island, nowhere near Venetian land, and all the Knights hold.
    s.regions.rhodes.controller = 'VEN';
    expect(buildDemands(s, w, 'VEN', 60).regions).toContain('rhodes');
    // Nothing occupied, no gold to pay: vassalage, if the leverage covers it.
    s.regions.rhodes.controller = 'KNI';
    s.nations.KNI.gold = 0;
    const terms = buildDemands(s, w, 'VEN', 60);
    expect(terms.regions).toEqual([]);
    expect(terms.vassalize).toBe(true);
    expect(peaceCost(s, terms)).toBeLessThanOrEqual(60);
    expect(buildDemands(s, w, 'VEN', peaceCost(s, terms) - 1).vassalize).toBe(false);
    // Never a great crown.
    forceWar(s, 'CAS', 'ARA');
    const big = declareWar(s, 'CAS', 'ARA', 'none')!;
    s.nations.ARA.gold = 0;
    for (const r of ownedRegions(s, 'ARA')) r.cores = r.cores.filter(c => c !== 'CAS');
    s.nations.CAS.claims = {};
    expect(buildDemands(s, big, 'CAS', 100).vassalize).toBe(false);
  });

  test('a great crown down to its heartland gives up one region a peace', () => {
    const s = emptyGame('POR');
    s.alliances = {};
    forceWar(s, 'HUN', 'HAB');
    const w = declareWar(s, 'HUN', 'HAB', 'none')!;
    const austria = ownedRegions(s, 'HAB');
    expect(austria.length).toBeLessThanOrEqual(4);
    for (const r of austria) r.controller = 'HUN';
    const terms = buildDemands(s, w, 'HUN', 100);
    expect(terms.regions.filter(r => s.regions[r].owner === 'HAB')).toHaveLength(1);
  });

  test('a winner with nothing to ask for settles after a year; a war neither side can reach ends after one', () => {
    const s = emptyGame('POR');
    s.alliances = {};
    forceWar(s, 'CAS', 'ARA');
    const w = declareWar(s, 'CAS', 'ARA', 'none')!;
    s.nations.ARA.gold = 0;
    s.nations.CAS.claims = {};
    for (const r of ownedRegions(s, 'ARA')) r.cores = r.cores.filter(c => c !== 'CAS');
    w.battleScore = 30;
    const owners = Object.fromEntries(Object.values(s.regions).map(r => [r.id, r.owner]));
    w.started = s.day - years(0.5);
    debugAI.aiPeace(s, s.nations.CAS);
    expect(s.wars[w.id]).toBeDefined(); // young: fight on
    w.started = s.day - years(1.1);
    debugAI.aiPeace(s, s.nations.CAS);
    expect(s.wars[w.id]).toBeUndefined();
    for (const r of Object.values(s.regions)) expect(r.owner).toBe(owners[r.id]);
    // Venice and the Knights, with no ships between them: nothing can happen, so it ends.
    forceWar(s, 'VEN', 'KNI');
    const sea = declareWar(s, 'VEN', 'KNI', 'none')!;
    sea.started = s.day - years(1.1);
    debugAI.aiPeace(s, s.nations.VEN);
    expect(s.wars[sea.id]).toBeUndefined();
  });

  test('only the allies who would answer the call count as defenders', () => {
    const s = emptyGame('POR');
    s.alliances = {};
    forceWar(s, 'CAS', 'GRA');
    s.alliances[pairKey('GRA', 'MOR')] = s.day;
    // Morocco would come; tied up in two wars, it would not.
    expect(likelySides(s, 'CAS', 'GRA').defenders).toContain('MOR');
    forceWar(s, 'MOR', 'POR');
    forceWar(s, 'MOR', 'ARA');
    declareWar(s, 'POR', 'MOR', 'none');
    declareWar(s, 'ARA', 'MOR', 'none');
    expect(aiAnswersCall(s, 'MOR', 'GRA', 'CAS', true)).toBe(false);
    expect(likelySides(s, 'CAS', 'GRA').defenders).not.toContain('MOR');
  });
});
