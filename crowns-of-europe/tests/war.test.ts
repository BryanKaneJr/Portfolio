import { emptyGame, army, forceWar } from './helpers';
import { aiAnswersCall, casusBelli, declareWar, likelySides, makePeace, peaceCost, warScore, buildDemands } from '../src/sim/war';
import { advanceDays } from '../src/sim/tick';
import { pairKey } from '../src/sim/util';
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

  /** England (the player) losing to Scotland, which holds `lev` leverage and claims Yorkshire. */
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
    expect(concessionValue(s, w, 'SCO', 'yorkshire')).toEqual({ value: regionPeaceCost(s, 'SCO', 'yorkshire'), why: 'they claim it' });
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
