import { emptyGame, forceWar } from './helpers';
import { opinionModsOf } from '../src/sim/diplomacy';
import { pairKey } from '../src/sim/util';
import { TRUCE_BREAK, UNJUST_LAND, UNJUST_WAR, declareWar, likelySides, makePeace, unjustThreat } from '../src/sim/war';

/** The opinion `from` holds of `to` for one cause. */
const mod = (s: Parameters<typeof opinionModsOf>[0], from: string, to: string, id: string) => opinionModsOf(s, from, to).find(m => m.id === id)?.value ?? 0;

describe('the price of an unjust war or a broken truce', () => {
  test('a war without a reason costs order, renown, Threat and goodwill, and more each time within ten years', () => {
    const s = emptyGame('FRA');
    const fra = s.nations.FRA;
    fra.stability = 2;
    fra.prestige = 50;
    fra.threat = 0;
    forceWar(s, 'FRA', 'BUR');
    expect(unjustThreat(s, 'FRA')).toBe(UNJUST_WAR.threat);
    declareWar(s, 'FRA', 'BUR', 'none', undefined, 'player');
    expect(fra.stability).toBe(2 - UNJUST_WAR.order);
    expect(fra.prestige).toBe(50 - UNJUST_WAR.renown);
    expect(fra.threat).toBeCloseTo(UNJUST_WAR.threat, 5);
    expect(mod(s, 'CAS', 'FRA', 'warmonger')).toBe(UNJUST_WAR.opinion);
    // A second within ten years: Threat 20 + 10.
    expect(unjustThreat(s, 'FRA')).toBe(UNJUST_WAR.threat + UNJUST_WAR.repeat);
    forceWar(s, 'FRA', 'SAV');
    declareWar(s, 'FRA', 'SAV', 'none', undefined, 'player');
    expect(fra.threat).toBeCloseTo(2 * UNJUST_WAR.threat + UNJUST_WAR.repeat, 5);
    expect(mod(s, 'CAS', 'FRA', 'warmonger')).toBe(2 * UNJUST_WAR.opinion);
  });

  test('land taken in an unjust war adds half as much Threat again, for the aggressor only', () => {
    const threatFor = (cb: 'none' | 'rival', victimWins = false) => {
      const s = emptyGame('FRA');
      forceWar(s, 'FRA', 'BUR');
      s.nations.FRA.claims = {};
      s.nations.BUR.claims = {};
      const w = declareWar(s, 'FRA', 'BUR', cb, undefined, 'player')!;
      s.nations.FRA.threat = 0;
      s.nations.BUR.threat = 0;
      if (victimWins) {
        makePeace(s, w, { winner: 'BUR', loser: 'FRA', regions: ['champagne'], gold: 0, release: [], vassalize: false });
        return s.nations.BUR.threat;
      }
      makePeace(s, w, { winner: 'FRA', loser: 'BUR', regions: ['burgundy'], gold: 0, release: [], vassalize: false });
      return s.nations.FRA.threat;
    };
    expect(threatFor('none')).toBeCloseTo(threatFor('rival') * UNJUST_LAND, 5);
    // The victim of an unjust attack that wins and takes land pays the usual Threat.
    expect(threatFor('none', true)).toBeCloseTo(threatFor('rival', true), 5);
  });

  test('no ally answers a truce-breaker, the player included, and the war screen says so', () => {
    const s = emptyGame('SCO'); // France's old ally
    s.nations.FRA.claims.normandy = -1;
    expect(likelySides(s, 'FRA', 'ENG').attackers).not.toContain('SCO');
    const w = declareWar(s, 'FRA', 'ENG', 'claim', 'normandy', 'ai')!;
    expect(w.brokeTruce).toBe(true);
    expect(s.offers.some(o => o.kind === 'callToArms' && o.war === w.id)).toBe(false);
    expect(w.attackers).not.toContain('SCO');
  });

  test('breaking a truce costs more still, and no ally answers the call', () => {
    const s = emptyGame('FRA');
    const fra = s.nations.FRA;
    fra.stability = 3;
    fra.prestige = 60;
    fra.threat = 0;
    fra.claims.normandy = -1;
    expect((s.truces[pairKey('ENG', 'FRA')] ?? 0) > s.day).toBe(true); // Tours, 1444
    const w = declareWar(s, 'FRA', 'ENG', 'claim', 'normandy', 'player')!;
    expect(w.brokeTruce).toBe(true);
    expect(fra.stability).toBe(3 - TRUCE_BREAK.order);
    expect(fra.prestige).toBe(60 - TRUCE_BREAK.renown);
    expect(fra.threat).toBeCloseTo(TRUCE_BREAK.threat, 5);
    expect(mod(s, 'CAS', 'FRA', 'oathbreaker')).toBe(TRUCE_BREAK.opinion);
    // Scotland and Castile, France's allies, are not called (its vassal Provence follows it, as subjects do).
    expect(w.attackers).not.toContain('SCO');
    expect(w.attackers).not.toContain('CAS');
    expect(w.attackers.every(x => x === 'FRA' || s.nations[x].overlord === 'FRA')).toBe(true);
  });

  test('a war an event starts in a truce is history, not a broken oath', () => {
    const s = emptyGame('POR');
    const fra = s.nations.FRA;
    fra.threat = 0;
    const w = declareWar(s, 'FRA', 'ENG', 'claim', 'normandy', 'event')!;
    expect(w.brokeTruce).toBeUndefined();
    expect(fra.threat).toBe(0);
  });
});
