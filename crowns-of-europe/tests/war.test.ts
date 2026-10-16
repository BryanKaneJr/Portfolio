import { emptyGame, army, forceWar } from './helpers';
import { aiAnswersCall, casusBelli, declareWar, likelySides, makePeace, peaceCost, warScore, buildDemands } from '../src/sim/war';
import { advanceDays } from '../src/sim/tick';
import { pairKey, years } from '../src/sim/util';
import { REBELS, seesUnit } from '../src/sim/queries';
import * as peace from '../src/sim/war';
import { answerOffer, proposePeace } from '../src/sim/commands';
import { debugAI } from '../src/sim/ai';
import type { GameState, PeaceTerms, War } from '../src/sim/types';

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
    // A crown planning a war counts only the allies who would come (with the truce of Tours over: nobody joins a
    // truce-breaker).
    s.alliances[pairKey('DAN', 'FRA')] = s.day;
    expect(likelySides(s, 'FRA', 'ENG').attackers).not.toContain('SCO');
    delete s.truces[pairKey('ENG', 'FRA')];
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
    expect(s.truces[pairKey('FRA', 'BUR')]).toBe(s.day + years(5));
  });

  test('a truce lasts 5 years, a year more for every 5% of leverage the deal is worth, up to 15', () => {
    for (const [cost, y] of [[0, 5], [8, 7], [13, 8], [26, 10], [47, 14], [48, 15], [200, 15]]) expect(peace.truceYears(cost)).toBe(y);
  });

  test('the truce is reckoned from the deal before the land moves', () => {
    const s = emptyGame('POR');
    s.nations.FRA.claims.normandy = -1;
    forceWar(s, 'FRA', 'ENG');
    const w = declareWar(s, 'FRA', 'ENG', 'claim', 'normandy')!;
    const terms: PeaceTerms = { regions: ['normandy'], gold: 0, vassalize: false, release: [], winner: 'FRA', loser: 'ENG' };
    expect(peaceCost(s, terms)).toBe(13);
    makePeace(s, w, terms);
    expect(s.regions.normandy.owner).toBe('FRA');
    // 13% → 8 years; reckoned after the land changed hands (no longer claimed) it would be 9.
    expect(s.truces[pairKey('FRA', 'ENG')]).toBe(s.day + years(8));
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

  test('a limited war won by its attackers takes only its goal', () => {
    const s = emptyGame('POR');
    s.alliances = {};
    forceWar(s, 'FRA', 'BUR');
    const w = declareWar(s, 'FRA', 'BUR', 'none', 'picardy')!;
    for (const r of ownedRegions(s, 'BUR')) r.controller = 'FRA';
    expect(buildDemands(s, w, 'FRA', 100).regions.length).toBeGreaterThan(1);
    w.limited = true;
    expect(buildDemands(s, w, 'FRA', 100).regions).toEqual(['picardy']);
    // The defenders, winning, are not held to it.
    for (const r of ownedRegions(s, 'FRA')) r.controller = 'BUR';
    expect(buildDemands(s, w, 'BUR', 100).regions.length).toBeGreaterThan(1);
  });

  test('a subject that wins its war of independence goes free, even from a penniless overlord', () => {
    const { makeSubject } = require('../src/sim/territory') as typeof import('../src/sim/territory'); // eslint-disable-line @typescript-eslint/no-require-imports
    const s = emptyGame('FRA');
    s.alliances = {};
    forceWar(s, 'CAS', 'GRA');
    makeSubject(s, 'CAS', 'GRA', 'vassal');
    const w = declareWar(s, 'GRA', 'CAS', 'independence')!;
    w.started = s.day - years(1.1);
    w.battleScore = 40;
    s.nations.CAS.gold = 10;
    debugAI.aiPeace(s, s.nations.GRA);
    expect(s.wars[w.id]).toBeUndefined();
    expect(s.nations.GRA.overlord).toBeUndefined();
  });

  test('the ruler leads the main army (not a detachment), never two at once, and hands over to a new ruler', () => {
    const { rulerAsGeneral } = require('../src/sim/rulers') as typeof import('../src/sim/rulers'); // eslint-disable-line @typescript-eslint/no-require-imports
    const { applyEffect } = require('../src/sim/events') as typeof import('../src/sim/events'); // eslint-disable-line @typescript-eslint/no-require-imports
    const s = emptyGame('FRA');
    const nat = s.nations.TUR;
    nat.generals = [];
    expect(rulerAsGeneral(s, 'TUR').stars).toBeGreaterThanOrEqual(3);
    expect(nat.heir).toBeDefined();
    const main = army(s, 'TUR', nat.capital, 30);
    main.general = { id: 'g1', name: 'Hired', stars: 1, hired: s.day, lifespan: 1e6 };
    const tiny = army(s, 'TUR', nat.capital, 1);
    debugAI.aiGenerals(s, nat);
    expect(main.general?.isRuler).toBe(true);
    expect(tiny.general?.name).toBe('Hired'); // the general he displaced takes the next army
    // His army in a rout: he is not sent to lead another as well.
    main.retreating = true;
    tiny.general = undefined;
    debugAI.aiGenerals(s, nat);
    expect(Object.values(s.armies).filter(a => a.general?.isRuler)).toHaveLength(1);
    main.retreating = false;
    // A new ruler: the old one no longer commands, and the new one takes the field.
    applyEffect(s, 'TUR', { newRuler: { name: 'Mehmed II', skill: 5, traits: ['warrior'], age: 19 } } as never);
    expect(Object.values(s.armies).some(a => a.general?.name === nat.ruler.name)).toBe(false);
    debugAI.aiGenerals(s, nat);
    const led = Object.values(s.armies).filter(a => a.general?.isRuler);
    expect(led.map(a => a.general!.name)).toEqual(['Mehmed II']);
  });

  test('an army never marches to a battle it could not join (hostile to both sides)', () => {
    const s = granadaWar();
    forceWar(s, 'CAS', 'POR');
    declareWar(s, 'CAS', 'POR', 'none');
    forceWar(s, 'GRA', 'POR');
    declareWar(s, 'POR', 'GRA', 'none');
    const gra = army(s, 'GRA', 'andalusia', 10);
    army(s, 'POR', 'andalusia', 30);
    const { joinOrStartBattle } = require('../src/sim/battle') as typeof import('../src/sim/battle'); // eslint-disable-line @typescript-eslint/no-require-imports
    joinOrStartBattle(s, 'andalusia', gra);
    expect(gra.battle).toBeDefined();
    const cas = army(s, 'CAS', 'toledo', 8);
    expect(attackOdds(s, [cas], gra).win).toBe(false);
  });
});

describe('ultimatums and the player’s own peace offers', () => {
  const { ULTIMATUM_DAYS, ULTIMATUM_SCORE, concessionValue, demandableRegions, fitTerms, peaceAcceptance, proposalAnswer, regionPeaceCost, scoreFor } = peace;
  const PORTUGAL = ['lisbon', 'porto', 'alentejo', 'azores', 'madeira'];
  /** The player (Portugal) at war with Castile, which holds all of Portugal: leverage 80 plus `battles`. */
  function beaten(battles: number): { s: GameState; w: War } {
    const s = emptyGame('POR');
    s.alliances = {};
    forceWar(s, 'CAS', 'POR');
    const w = declareWar(s, 'CAS', 'POR', 'none')!;
    w.battleScore = battles;
    for (const r of PORTUGAL) s.regions[r].controller = 'CAS';
    return { s, w };
  }
  const peaceOffers = (s: GameState) => s.offers.filter(o => o.kind === 'peace');
  const due = (s: GameState) => (peaceOffers(s)[0] as { ultimatum?: number } | undefined)?.ultimatum;
  const owners = (s: GameState) => PORTUGAL.map(r => s.regions[r].owner);

  test('an ultimatum comes only at 99% leverage, asking no more than that and only land Castile may demand', () => {
    const { s, w } = beaten(18);
    expect(scoreFor(s, w, 'CAS')).toBe(98);
    debugAI.aiPeace(s, s.nations.CAS);
    // Below it: an ordinary proposal, and no clock.
    expect(w.ultimatum).toBeUndefined();
    expect(peaceOffers(s)).toHaveLength(1);
    expect(due(s)).toBeUndefined();
    w.battleScore = 19;
    expect(scoreFor(s, w, 'CAS')).toBe(ULTIMATUM_SCORE);
    debugAI.aiPeace(s, s.nations.CAS);
    const u = w.ultimatum!;
    expect(u.due).toBe(s.day + ULTIMATUM_DAYS);
    // It replaces the proposal still waiting.
    expect(peaceOffers(s)).toHaveLength(1);
    expect(due(s)).toBe(u.due);
    expect(u.terms.regions.length).toBeGreaterThan(0);
    expect(peaceCost(s, u.terms)).toBeLessThanOrEqual(scoreFor(s, w, 'CAS'));
    const may = demandableRegions(s, w, 'CAS');
    for (const r of u.terms.regions) expect(may).toContain(r);
    // It stands until its day: no second one.
    const seq = s.seq;
    debugAI.aiPeace(s, s.nations.CAS);
    expect(s.seq).toBe(seq);
  });

  test('the terms are imposed when the day comes, if Castile still holds 99%', () => {
    const { s, w } = beaten(25);
    debugAI.aiPeace(s, s.nations.CAS);
    const u = w.ultimatum!;
    // Refusing the card doesn't stop the clock.
    expect(answerOffer(s, peaceOffers(s)[0].id, false).ok).toBe(true);
    expect(w.ultimatum).toBe(u);
    advanceDays(s, ULTIMATUM_DAYS - 1);
    expect(s.wars[w.id]).toBeDefined();
    const lev = scoreFor(s, w, 'CAS');
    const imposed = fitTerms(s, w, u.terms, lev);
    expect(imposed.regions).toEqual(u.terms.regions);
    expect(peaceCost(s, imposed)).toBeLessThanOrEqual(lev);
    advanceDays(s, 1);
    expect(s.wars[w.id]).toBeUndefined();
    for (const r of u.terms.regions) expect(s.regions[r].owner).toBe('CAS');
    expect(s.log.some(l => l.important && /imposes the terms of its ultimatum/.test(l.text))).toBe(true);
    expect(peaceOffers(s)).toHaveLength(0);
  });

  test('an ultimatum lapses if the player wins leverage back, and may come again', () => {
    const { s, w } = beaten(25);
    debugAI.aiPeace(s, s.nations.CAS);
    expect(w.ultimatum).toBeDefined();
    const before = owners(s);
    for (const r of PORTUGAL) s.regions[r].controller = 'POR';
    advanceDays(s, ULTIMATUM_DAYS);
    expect(s.wars[w.id]).toBeDefined();
    expect(w.ultimatum).toBeUndefined();
    expect(owners(s)).toEqual(before);
    expect(peaceOffers(s)).toHaveLength(0);
    expect(s.log.some(l => /ultimatum lapses/.test(l.text))).toBe(true);
    // Losing it all again, a new one.
    for (const r of PORTUGAL) s.regions[r].controller = 'CAS';
    debugAI.aiPeace(s, s.nations.CAS);
    expect(w.ultimatum?.due).toBe(s.day + ULTIMATUM_DAYS);
  });

  test('imposed terms are cut to the leverage held and to land still demandable', () => {
    const { s, w } = beaten(25);
    s.regions.azores.controller = 'POR'; // no longer demandable
    s.nations.POR.gold = 300;
    const asked: PeaceTerms = { regions: ['azores', 'lisbon', 'porto', 'alentejo'], gold: 300, vassalize: false, release: [], winner: 'CAS', loser: 'POR' };
    const fitted = fitTerms(s, w, asked, 50);
    expect(fitted.regions).toEqual(['lisbon', 'porto']); // 36% + 12%: Alentejo (9%) no longer fits
    expect(fitted.gold).toBe(20);
    expect(peaceCost(s, fitted)).toBeLessThanOrEqual(50);
  });

  test('if your gold runs low, the ultimatum asks only what you have, and you can still accept it', () => {
    const { s, w } = beaten(25);
    s.nations.POR.gold = 1000;
    debugAI.aiPeace(s, s.nations.CAS);
    expect(w.ultimatum).toBeDefined();
    expect(w.ultimatum!.terms.gold).toBeGreaterThan(10);
    s.nations.POR.gold = 10;
    const now = peace.ultimatumTerms(s, w)!;
    expect(now.gold).toBeLessThanOrEqual(10);
    expect(now.regions).toEqual(w.ultimatum!.terms.regions);
    expect(proposePeace(s, w.id, now).ok).toBe(true);
    expect(s.wars[w.id]).toBeUndefined();
  });

  test('a peace accepted in the window cancels the ultimatum', () => {
    // Accepting the card.
    const a = beaten(25);
    debugAI.aiPeace(a.s, a.s.nations.CAS);
    expect(answerOffer(a.s, peaceOffers(a.s)[0].id, true).ok).toBe(true);
    expect(a.s.wars[a.w.id]).toBeUndefined();
    // Refusing it, then giving in from the war screen with their own terms.
    const b = beaten(25);
    debugAI.aiPeace(b.s, b.s.nations.CAS);
    const u = b.w.ultimatum!;
    answerOffer(b.s, peaceOffers(b.s)[0].id, false);
    advanceDays(b.s, 10);
    const answer = proposalAnswer(b.s, b.w, u.terms, 'POR');
    expect(answer.accept).toBe(true);
    expect(answer.reasons.some(r => r.label === 'Their ultimatum met')).toBe(true);
    expect(proposePeace(b.s, b.w.id, u.terms).ok).toBe(true);
    expect(b.s.wars[b.w.id]).toBeUndefined();
    const seen = Math.max(...b.s.log.map(l => l.id));
    advanceDays(b.s, ULTIMATUM_DAYS);
    expect(b.s.log.some(l => l.id > seen && /ultimatum/.test(l.text))).toBe(false);
    expect(peaceOffers(b.s)).toHaveLength(0);
  });

  /** England (the player) losing to Scotland, which holds `lev` leverage and claims Northumbria. */
  function englandLosing(lev: number): { s: GameState; w: War } {
    const s = emptyGame('ENG');
    s.alliances = {};
    forceWar(s, 'SCO', 'ENG');
    const w = declareWar(s, 'SCO', 'ENG', 'none')!;
    w.battleScore = lev;
    s.nations.SCO.warExhaustion = 0;
    return { s, w };
  }
  const offer = (regions: string[], gold = 0): PeaceTerms => ({ regions, gold, vassalize: false, release: [], winner: 'SCO', loser: 'ENG' });

  test('land far from the enemy is worth half to them; land they claim, its full price', () => {
    const { s, w } = englandLosing(20);
    expect(concessionValue(s, w, 'SCO', 'northumbria')).toEqual({ value: regionPeaceCost(s, 'SCO', 'northumbria'), why: 'they claim it' });
    const gascony = concessionValue(s, w, 'SCO', 'gascony');
    expect(gascony.value).toBe(Math.round(regionPeaceCost(s, 'SCO', 'gascony') / 2));
    expect(gascony.why).toMatch(/far from their land/);
  });

  test('the player can end a losing war by offering distant land of enough value; too little is refused', () => {
    const { s, w } = englandLosing(20);
    expect(scoreFor(s, w, 'SCO')).toBe(20);
    // Gascony alone (half its price, far from Scotland) does not cover their leverage.
    const little = offer(['gascony']);
    const no = proposalAnswer(s, w, little, 'ENG');
    expect(no.accept).toBe(false);
    expect(no.reasons.find(r => r.label === 'Worth to them')?.value).toBe(concessionValue(s, w, 'SCO', 'gascony').value);
    expect(proposePeace(s, w.id, little).ok).toBe(false);
    expect(s.wars[w.id]).toBeDefined();
    // Gascony and Normandy do: England keeps Yorkshire, the land Scotland claims.
    const enough = offer(['gascony', 'normandy']);
    expect(proposalAnswer(s, w, enough, 'ENG').accept).toBe(true);
    expect(peaceAcceptance(s, w, enough, 'SCO').accept).toBe(true);
    expect(proposePeace(s, w.id, enough).ok).toBe(true);
    expect(s.wars[w.id]).toBeUndefined();
    expect(s.regions.gascony.owner).toBe('SCO');
    expect(s.regions.normandy.owner).toBe('SCO');
    expect(s.regions.yorkshire.owner).toBe('ENG');
  });

  test('the verdict shown is what proposePeace does, gold included', () => {
    const { s, w } = englandLosing(20);
    s.nations.ENG.gold = 120;
    const verdicts: boolean[] = [];
    for (const t of [offer([], 50), offer([], 100), offer(['calais'], 100), offer(['wales', 'pale'], 400), offer(['london']), offer(['london', 'paris'])]) {
      const copy = JSON.parse(JSON.stringify(s)) as GameState;
      const shown = proposalAnswer(s, w, t, 'ENG');
      expect(proposePeace(copy, w.id, t).ok).toBe(shown.accept);
      expect(shown.accept).toBe(shown.reasons.reduce((a, r) => a + r.value, 0) >= 0);
      verdicts.push(shown.accept);
    }
    expect(verdicts).toContain(true);
    expect(verdicts).toContain(false);
    // Demands within your leverage can't be refused, even a capital they'd rather keep.
    const d = emptyGame('CAS');
    d.alliances = {};
    forceWar(d, 'CAS', 'POR');
    const dw = declareWar(d, 'CAS', 'POR', 'none')!;
    dw.battleScore = 10;
    d.regions.lisbon.controller = 'CAS';
    const demand: PeaceTerms = { regions: ['lisbon'], gold: 0, vassalize: false, release: [], winner: 'CAS', loser: 'POR' };
    expect(peaceCost(d, demand)).toBeLessThanOrEqual(scoreFor(d, dw, 'CAS'));
    expect(peaceAcceptance(d, dw, demand, 'POR').accept).toBe(false);
    const shown = proposalAnswer(d, dw, demand, 'CAS');
    expect(shown.accept).toBe(true);
    expect(shown.reasons.some(r => r.label === 'Within your leverage')).toBe(true);
    expect(proposePeace(d, dw.id, demand).ok).toBe(true);
  });
});
