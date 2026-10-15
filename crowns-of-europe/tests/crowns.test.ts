import { CROWN, CROWNS, NATION, bindDisplay, displayIn, nationAdj, nationName } from '../src/sim/content';
import { proclaimCrown } from '../src/sim/commands';
import { canProclaim, crownProgress, monthlyCrowns, proclaim } from '../src/sim/crowns';
import { applyEffect, walkEffects } from '../src/sim/events';
import { newGame } from '../src/sim/state';
import { makeSubject, transferRegion } from '../src/sim/territory';
import { advanceDay } from '../src/sim/tick';
import type { GameState, NationId } from '../src/sim/types';
import { dateOf, dayOf, yearOf } from '../src/sim/util';
import { declareWar } from '../src/sim/war';
import { emptyGame } from './helpers';

/** A quiet game with no wars and order 1 for everyone, so only lands, years and subjects decide. */
function calm(player: NationId, year = 1444): GameState {
  const s = emptyGame(player);
  s.wars = {};
  if (year > 1444) s.day = dayOf(year, 0, 2);
  for (const n of Object.values(s.nations)) n.stability = 1;
  bindDisplay(s);
  return s;
}
const give = (s: GameState, n: NationId, regions: string[]) => regions.forEach(r => transferRegion(s, r, n));

afterAll(() => bindDisplay(null));

describe('the Naples chain: Two Sicilies, Italy, the Roman Empire', () => {
  test('Naples proclaims the Two Sicilies, then Italy, then (as a player) the Roman Empire', () => {
    const s = calm('NAP');
    expect(canProclaim(s, 'NAP', 'SIC')).toBe('Needs Sicily');
    give(s, 'NAP', ['sicily']);
    expect(canProclaim(s, 'NAP', 'SIC')).toBeNull();
    expect(proclaimCrown(s, 'SIC').ok).toBe(true);
    expect(nationName('NAP')).toBe('Two Sicilies');
    expect(nationAdj('NAP')).toBe('Sicilian');
    expect(displayIn(s, 'NAP').color).toBe(NATION.NAP.color); // still Naples' teal
    expect(s.nations.NAP.claims.sardinia).toBeGreaterThan(s.day);
    expect(s.nations.NAP.claims.romagna).toBeGreaterThan(s.day);
    expect(s.nations.NAP.modifiers.some(m => m.id === 'crown_SIC' && m.until === -1)).toBe(true);
    expect(s.flags.crown_SIC).toBe(s.day);
    // Once proclaimed, a crown is gone for good, and Naples can only go on to the crowns that name it.
    expect(canProclaim(s, 'NAP', 'SIC')).toBe('You already hold it');
    expect(crownProgress(s, 'NAP').map(p => p.id)).toEqual(['ITA']);
    // A war is named for the new crown.
    let war = null;
    for (const n of ['VEN', 'FLO', 'MLO', 'HUN']) if ((war = declareWar(s, 'NAP', n, 'claim'))) break;
    expect(war?.name).toMatch(/^Sicilian–/);
    s.wars = {};
    s.nations.NAP.stability = 1;

    // Naples holds 5 of Italy's lands as the Two Sicilies; Italy needs 16.
    give(s, 'NAP', ['lombardy', 'tuscany', 'romagna', 'rome', 'liguria', 'messina', 'marche', 'umbria', 'siena', 'veneto', 'verona']);
    expect(proclaimCrown(s, 'ITA').ok).toBe(true);
    expect(nationName('NAP')).toBe('Italy');
    expect(displayIn(s, 'NAP').flag.pattern).toBe('tiercedPale');
    expect(s.nations.NAP.claims.constantinople).toBeGreaterThan(s.day);
    expect(s.nations.NAP.modifiers.filter(m => m.id.startsWith('crown_')).length).toBe(2); // bonuses stack

    give(s, 'NAP', CROWN.ROM.regions.filter(r => r !== 'constantinople').slice(0, 18));
    expect(canProclaim(s, 'NAP', 'ROM')).toBe('Needs Constantinople');
    give(s, 'NAP', ['constantinople']);
    // The computer never proclaims the Roman Empire.
    const ai = { ...s, player: 'FRA' } as GameState;
    expect(canProclaim(ai, 'NAP', 'ROM')).toBe('Only for players');
    expect(crownProgress(ai, 'NAP').map(p => p.id)).not.toContain('ROM');
    expect(canProclaim(s, 'NAP', 'ROM')).toBeNull();
    expect(proclaimCrown(s, 'ROM').ok).toBe(true);
    expect(nationName('NAP')).toBe('Roman Empire');
    for (const f of ['crown_SIC', 'crown_ITA', 'crown_ROM']) expect(s.nations.NAP.flags[f]).toBeDefined();
  });

  test('the player hears once when a crown comes within reach', () => {
    const s = calm('NAP');
    give(s, 'NAP', ['sicily']);
    monthlyCrowns(s);
    monthlyCrowns(s);
    expect(s.log.filter(l => l.text.startsWith('You may proclaim the Two Sicilies')).length).toBe(1);
    expect(s.nations.NAP.crown).toBeUndefined(); // the player decides
  });
});

describe('who may proclaim what', () => {
  test('the Ottomans may not proclaim Greece, even holding the Morea', () => {
    const s = calm('FRA');
    give(s, 'TUR', CROWN.HEL.regions);
    expect(canProclaim(s, 'TUR', 'HEL')).toMatch(/^Not open to/);
  });

  test('Burgundy waits for 1560 for the Netherlands, and may not proclaim it as a subject', () => {
    const s = calm('FRA');
    give(s, 'BUR', CROWN.NED.regions);
    expect(canProclaim(s, 'BUR', 'NED')).toBe('Not before 1560');
    s.day = dayOf(1561, 0, 2);
    expect(canProclaim(s, 'BUR', 'NED')).toBeNull();
    makeSubject(s, 'FRA', 'BUR', 'vassal');
    expect(canProclaim(s, 'BUR', 'NED')).toBe('Not while a subject');
  });

  test('Castile with Aragon in a shared crown proclaims Spain, and Aragon stays its junior partner; never a player Aragon', () => {
    for (const player of ['FRA', 'ARA']) {
      const s = calm(player, 1470);
      makeSubject(s, 'CAS', 'ARA', 'union');
      give(s, 'CAS', ['granada']);
      if (player === 'FRA') {
        expect(canProclaim(s, 'CAS', 'SPA')).toBeNull();
        proclaim(s, 'CAS', 'SPA');
        expect(s.nations.ARA.alive).toBe(true);
        expect(s.nations.ARA.overlord).toBe('CAS');
        expect(s.regions.aragon.owner).toBe('ARA');
        // Claims only on the lands of the crown that touch the realm: Navarre borders Castile and Aragon, Portugal's
        // Porto borders Galicia; nothing on lands far from it.
        expect('navarre' in s.nations.CAS.claims).toBe(true);
      } else {
        // A player's lands never count toward another's crown, and a player is never joined to it.
        expect(canProclaim(s, 'CAS', 'SPA')).toBe('Needs Aragon');
        give(s, 'CAS', ['navarre', 'porto', 'lisbon', 'alentejo', 'aragon']);
        expect(canProclaim(s, 'CAS', 'SPA')).toBeNull();
        proclaim(s, 'CAS', 'SPA');
        expect(s.nations.ARA.alive).toBe(true);
      }
      expect(nationName('CAS')).toBe('Spain');
    }
  });

  test('war and disorder hold a crown back', () => {
    const s = calm('NAP');
    give(s, 'NAP', ['sicily']);
    s.nations.NAP.stability = -1;
    expect(canProclaim(s, 'NAP', 'SIC')).toBe('Needs order 0 or better');
    s.nations.NAP.stability = 1;
    let war = null;
    for (const n of ['VEN', 'FLO', 'MLO', 'HUN']) if ((war = declareWar(s, 'NAP', n, 'claim'))) break;
    expect(war).toBeTruthy();
    expect(canProclaim(s, 'NAP', 'SIC')).toBe('Not while at war');
  });
});

describe('a crown in the saved game', () => {
  test('a JSON round trip keeps the crown; a look-ahead copy does not change what is shown', () => {
    const s = calm('NAP');
    give(s, 'NAP', ['sicily']);
    proclaim(s, 'NAP', 'SIC');
    const back = JSON.parse(JSON.stringify(s)) as GameState;
    expect(back.nations.NAP.crown).toBe('SIC');
    expect(displayIn(back, 'NAP').name).toBe('Two Sicilies');
    // Two effects where the second reads what the first left: walkEffects works on a copy.
    let copied = false;
    walkEffects(s, 'NAP', [{ prestige: 5 }, { prestige: 5 }], c => {
      if (c === s) return;
      copied = true;
      c.nations.NAP.crown = undefined;
    });
    expect(copied).toBe(true);
    expect(nationName('NAP')).toBe('Two Sicilies');
    expect(s.nations.NAP.crown).toBe('SIC');
  });
});

describe("the computer's crowns", () => {
  test('two AI-only years: proclaims only what it may, in January, and replays the same', () => {
    const run = () => {
      const s = newGame({ player: 'POR', seed: 1 });
      s.flags.__spectate = 1;
      transferRegion(s, 'sicily', 'NAP'); // Naples is ready for the Two Sicilies from the start
      bindDisplay(s);
      const seen: string[] = [];
      for (let d = 0; d < 2 * 365; d++) {
        advanceDay(s);
        for (const c of CROWNS) {
          const by = Object.keys(s.nations).find(n => s.nations[n].flags['crown_' + c.id] === s.day);
          if (!by) continue;
          seen.push(`${yearOf(s.day)} ${by} ${c.id}`);
          expect(c.playerOnly).toBeFalsy();
          expect(yearOf(s.day)).toBeGreaterThanOrEqual(c.from ?? 0);
          expect(s.nations[by].overlord).toBeUndefined();
          expect(dateOf(s.day).month).toBe(0); // the computer proclaims in January only
        }
      }
      return { seen, rng: s.rng };
    };
    const a = run();
    expect(a.seen).toContain('1445 NAP SIC'); // the computer's Naples proclaims it on 1 January
    expect(a).toEqual(run());
    bindDisplay(null);
  });
});

describe('fixes from the fun batch 1 review', () => {
  test('Burgundy may go on from the Kingdom of Burgundy (or the Netherlands) to Francia', () => {
    const s = calm('BUR', 1470);
    proclaim(s, 'BUR', 'BRG');
    expect(canProclaim(s, 'BUR', 'FRK')).not.toMatch(/Not open/);
    expect(crownProgress(s, 'BUR').map(p => p.id)).toContain('FRK');
  });

  test('a taken crown names the realm as it was called when it proclaimed', () => {
    const s = calm('MLO');
    proclaim(s, 'NAP', 'SIC');
    proclaim(s, 'NAP', 'ITA');
    expect(canProclaim(s, 'MLO', 'ITA')).toBe('Proclaimed by Two Sicilies');
    expect(canProclaim(s, 'MLO', 'SIC')).toBe('Proclaimed by Naples');
  });

  test("a shared crown never takes another realm's subject, and the player's own choice of one is kept", () => {
    const s = calm('TUR');
    makeSubject(s, 'TUR', 'ALB', 'vassal');
    applyEffect(s, 'VEN', { personalUnion: 'ALB' });
    expect(s.nations.ALB.overlord).toBe('TUR');
    // The player (Brittany) refuses a crown forced on it, but takes one it asked for.
    const b = calm('BRI');
    applyEffect(b, 'FRA', { personalUnion: 'BRI' });
    expect(b.nations.BRI.overlord).toBeUndefined();
    b.nations.BRI.flags.accepts_union_FRA = b.day;
    applyEffect(b, 'FRA', { personalUnion: 'BRI' });
    expect(b.nations.BRI.overlord).toBe('FRA');
  });

  test("the realm's first fleet takes the crown's name", () => {
    const s = newGame({ player: 'NAP', seed: 1 });
    const f = Object.values(s.fleets).find(x => x.owner === 'NAP')!;
    expect(f.name).toBe(`${NATION.NAP.adj} Fleet`);
    proclaim(s, 'NAP', 'SIC');
    expect(f.name).toBe(`${CROWN.SIC.adj} Fleet`);
  });
});
