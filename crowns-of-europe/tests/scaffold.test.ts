import { CROWN, NATION, bindDisplay, displayIn, nationAdj, nationName } from '../src/sim/content';
import { moveArmy } from '../src/sim/commands';
import { moment, recentMoment } from '../src/sim/log';
import { findPath } from '../src/sim/military';
import { canEnter } from '../src/sim/queries';
import { newGame } from '../src/sim/state';
import { advanceDay } from '../src/sim/tick';
import type { CrownDef, GameState } from '../src/sim/types';

const testCrown: CrownDef = {
  id: 'ZZT',
  name: 'Test Crown',
  adj: 'Testish',
  color: '#123456',
  inherits: 'NAP',
  flag: { pattern: 'plain', colors: ['#123456', '#ffffff'] },
  regions: ['naples'],
  key: ['naples'],
  need: 1,
  formers: ['NAP'],
  mods: {},
  bonus: 'A test.',
  blurb: 'A test.',
  history: 'A test.',
};

describe('display layer', () => {
  let s: GameState;
  beforeAll(() => {
    CROWN.ZZT = testCrown;
  });
  afterAll(() => {
    delete CROWN.ZZT;
    bindDisplay(null);
  });
  beforeEach(() => {
    s = newGame({ player: 'FRA', seed: 1 });
  });

  test('a realm with no crown shows as itself', () => {
    const d = displayIn(s, 'NAP');
    expect(d).toMatchObject({ name: NATION.NAP.name, adj: NATION.NAP.adj, color: NATION.NAP.color, look: 'NAP' });
    expect(nationName('REB')).toBe('Rebels');
    expect(nationName(null)).toBe('Natives');
  });

  test('a proclaimed crown shows its name, arms and colour by the inherits rule', () => {
    s.nations.NAP.crown = 'ZZT';
    expect(displayIn(s, 'NAP')).toMatchObject({ name: 'Test Crown', adj: 'Testish', color: '#123456', look: 'ZZT' });
    // Another realm proclaims it while Naples lives: it keeps its own colour.
    s.nations.ARA.crown = 'ZZT';
    expect(displayIn(s, 'ARA').color).toBe(NATION.ARA.color);
    s.nations.NAP.alive = false;
    expect(displayIn(s, 'ARA').color).toBe('#123456');
    // The bound game drives nationName and nationAdj; a JSON round trip keeps the crown.
    bindDisplay(JSON.parse(JSON.stringify(s)));
    expect(nationName('ARA')).toBe('Test Crown');
    expect(nationAdj('ARA')).toBe('Testish');
    bindDisplay(null);
    expect(nationName('ARA')).toBe(NATION.ARA.name);
  });

  test('advanceDay binds the game it runs', () => {
    s.nations.NAP.crown = 'ZZT';
    bindDisplay(null);
    advanceDay(s);
    expect(nationName('NAP')).toBe('Test Crown');
  });
});

describe('moments', () => {
  test('kept to the last 20, and never draw on the random numbers', () => {
    const s = newGame({ player: 'FRA', seed: 1 });
    const rng = s.rng;
    for (let i = 0; i < 25; i++) moment(s, { kind: 'headline', card: false, tone: 'info', title: `M${i}`, nation: 'CAS' });
    expect(s.moments).toHaveLength(20);
    expect(s.moments![19].title).toBe('M24');
    expect(s.rng).toBe(rng);
    expect(recentMoment(s, 'headline', 'CAS')).toBe(true);
    expect(recentMoment(s, 'headline', 'ENG')).toBe(false);
    expect(recentMoment(s, 'invaded')).toBe(false);
  });
});

describe('the New World before discovery', () => {
  test('native armies march in their own lands; Europeans still cannot', () => {
    const s = newGame({ player: 'AZT', seed: 1 });
    const a = Object.values(s.armies).find(x => x.owner === 'AZT')!;
    expect(moveArmy(s, a.id, 'veracruz').ok).toBe(true);
    const hau = Object.values(s.armies).find(x => x.owner === 'HAU')!;
    expect(findPath(s, hau, 'huronia')).not.toBeNull();
    expect(canEnter(s, 'HAU', 'huronia')).toBe(true);
    expect(canEnter(s, 'CAS', 'huronia')).toBe(false);
    const cas = Object.values(s.armies).find(x => x.owner === 'CAS')!;
    expect(findPath(s, { ...cas, node: 'iroquoia' }, 'huronia')).toBeNull();
  });
});

describe('scenario 1444', () => {
  test('old friends are not rivals; the Horde and Crimea are; Naples claims Sicily', () => {
    const s = newGame({ player: 'FRA', seed: 1 });
    expect(s.nations.CAS.rivals).not.toContain('ARA');
    expect(s.nations.ARA.rivals).not.toContain('CAS');
    expect(s.nations.GOL.rivals).toContain('CRI');
    expect(s.nations.CRI.rivals).toContain('GOL');
    expect(s.alliances['CRI|GOL']).toBeUndefined();
    expect(s.nations.NAP.claims.sicily).toBeGreaterThan(s.day);
  });
});
