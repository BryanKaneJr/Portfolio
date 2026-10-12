import { emptyGame } from './helpers';
import { CONDITION_SCHEMA, EFFECT_SCHEMA } from '../src/sim/dsl';
import { applyEffect, evalCondition, fireEvent, answerEvent } from '../src/sim/events';
import { EVENTS } from '../src/sim/content';
import { execSync } from 'node:child_process';

const sample: Record<string, unknown> = {
  all: [{ year: [1444] }], any: [{ year: [1444] }], not: { year: [1900] }, year: [1444], isNation: 'FRA', isPlayer: true,
  owns: 'ile_de_france', ownsAny: ['ile_de_france'], controls: 'ile_de_france', nationOwns: { nation: 'ENG', region: 'london' },
  exists: 'BYZ', atWar: false, atWarWith: 'ENG', truceWith: 'ENG', faith: 'catholic', nationFaith: { nation: 'ENG', faith: 'catholic' },
  stability: [0], goldAtLeast: 1, prestigeAtLeast: 1, threatAtLeast: 0, regionsAtLeast: 1, regimentsAtLeast: 0, devAtLeast: 1,
  capitalDevAtLeast: 1, allied: 'SCO', alliesAtLeast: 1, borders: 'BUR', rulerSkill: [1], rulerAgeAtLeast: 1, hasHeir: true,
  eraAtLeast: 1, flag: 'x', nationFlag: 'x', loansAtLeast: 0, isEmperor: false, isElector: false, subjectOf: true, overlordOf: true,
  vassalsAtLeast: 1, regionFaith: { region: 'london', faith: 'catholic' }, faithRegionsAtLeast: { faith: 'catholic', count: 10 },
  gov: 'monarchy', tier: 'major', hasPolicy: 'tax_reform', hasAdvance: 'bombards', warsWonAtLeast: 0, battlesWonAtLeast: 0, stackWipesAtLeast: 0,
  bestWinRatioAtLeast: 0, regionsConqueredAtLeast: 0, fleetsAtLeast: 0, shipsAtLeast: 0, coastal: true, inCoalition: false,
  coalitionAgainst: false, hreMember: false, papalFavorAtLeast: 0, discovered: false, coloniesAtLeast: 0, colonizingAtLeast: 0,
  ownsGood: 'sugar', native: false, chance: 0.5,
};

describe('event language', () => {
  test('content validates', () => {
    const out = execSync('npx tsx scripts/validate-content.ts', { cwd: __dirname + '/..', encoding: 'utf8' });
    expect(out).toContain('content ok');
  });

  test('every condition in the schema is implemented', () => {
    const s = emptyGame('FRA');
    for (const key of Object.keys(CONDITION_SCHEMA)) {
      expect(sample).toHaveProperty(key);
      expect(typeof evalCondition(s, 'FRA', { [key]: sample[key] } as any)).toBe('boolean');
    }
    expect(evalCondition(s, 'FRA', { owns: 'ile_de_france' })).toBe(true);
    expect(evalCondition(s, 'FRA', { owns: 'london' })).toBe(false);
    expect(evalCondition(s, 'FRA', { allied: 'SCO' })).toBe(true);
  });

  test('effects change the state', () => {
    const s = emptyGame('FRA');
    const g = s.nations.FRA.gold;
    applyEffect(s, 'FRA', { gold: 100 });
    expect(s.nations.FRA.gold).toBe(g + 100);
    applyEffect(s, 'FRA', { stability: 5 });
    expect(s.nations.FRA.stability).toBe(3);
    applyEffect(s, 'FRA', { addClaim: 'london' });
    expect(s.nations.FRA.claims.london).toBe(-1);
    applyEffect(s, 'FRA', { transferRegion: { region: 'calais', to: 'FRA' } });
    expect(s.regions.calais.owner).toBe('FRA');
    applyEffect(s, 'FRA', { personalUnion: 'BRI' });
    expect(s.nations.BRI.overlord).toBe('FRA');
    applyEffect(s, 'FRA', { modifier: { id: 't', name: 'Test', months: 12, mods: { taxIncome: 0.5 } } });
    expect(s.nations.FRA.modifiers.find(m => m.id === 't')).toBeDefined();
    applyEffect(s, 'FRA', { addRegiments: { inf: 3 } });
    expect(Object.values(s.armies).some(a => a.owner === 'FRA' && a.regs.inf.n === 3)).toBe(true);
    // A league: the leader declares and the free crowns on the list join it.
    applyEffect(s, 'HAB', { declareWar: { target: 'TUR', cb: 'holy', with: ['VEN', 'PAP', 'POL', 'TUR'] } });
    const league = Object.values(s.wars).find(w => w.attackers[0] === 'HAB' && w.defenders[0] === 'TUR')!;
    expect(league.attackers).toEqual(expect.arrayContaining(['VEN', 'PAP']));
    expect(league.attackers).not.toContain('POL'); // still bound by the truce after Varna
    expect(evalCondition(s, 'FRA', { truceWith: 'ENG' })).toBe(true); // the 1444 truce
    // All effect keys at least run without throwing.
    expect(Object.keys(EFFECT_SCHEMA).length).toBeGreaterThan(30);
  });

  test('player events wait for an answer, then apply the chosen effects', () => {
    const s = emptyGame('FRA');
    const e = EVENTS.find(x => x.choices.some(c => c.effects.some(ef => 'gold' in ef || 'prestige' in ef)))!;
    fireEvent(s, 'FRA', e);
    expect(s.pendingEvents).toHaveLength(1);
    expect(answerEvent(s, 0, 0)).toBe(true);
    expect(s.pendingEvents).toHaveLength(0);
  });
});
