import { CROWN, CROWNS, NATION, bindDisplay, displayIn, nationAdj, nationName } from '../src/sim/content';
import { proclaimCrown } from '../src/sim/commands';
import { canProclaim, crownProgress, monthlyCrowns, proclaim } from '../src/sim/crowns';
import { walkEffects } from '../src/sim/events';
import { newGame } from '../src/sim/state';
import { makeSubject, transferRegion } from '../src/sim/territory';
import { advanceDay } from '../src/sim/tick';
import type { GameState, NationId } from '../src/sim/types';
import { dayOf, yearOf } from '../src/sim/util';
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

    give(s, 'NAP', ['lombardy', 'tuscany', 'romagna', 'rome', 'liguria']);
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

  test('Castile with Aragon in a shared crown proclaims Spain and joins Aragon to it; never a player Aragon', () => {
    for (const player of ['FRA', 'ARA']) {
      const s = calm(player, 1470);
      makeSubject(s, 'CAS', 'ARA', 'union');
      give(s, 'CAS', ['granada']);
      if (player === 'FRA') {
        expect(canProclaim(s, 'CAS', 'SPA')).toBeNull();
        proclaim(s, 'CAS', 'SPA');
        expect(s.nations.ARA.alive).toBe(false);
        expect(s.regions.aragon.owner).toBe('CAS');
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
    walkEffects(s, 'NAP', [{ prestige: 5 }, { prestige: 5 }], c => {
      if (c !== s) c.nations.NAP.crown = undefined;
    });
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
          expect(by).not.toBe(s.player);
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
