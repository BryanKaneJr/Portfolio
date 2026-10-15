/** Fun batch 1, track T1: one test (or more) per fixed bug. Short runs only. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyGame, army, forceWar } from './helpers';
import { findPath } from '../src/sim/military';
import { declareWar, makePeace } from '../src/sim/war';
import { advanceDay } from '../src/sim/tick';
import { ADVANCE, EVENT, EVENTS, NATION, isSea, namePool } from '../src/sim/content';
import { newGeneral, newPerson, toRoman } from '../src/sim/rulers';
import { applyEffect, checkAchievements, effectRegion, eligible, fireEvent } from '../src/sim/events';
import { spawnRebels } from '../src/sim/rebels';
import { MAX_MARRIAGES, REBELS, bumpOwnership, marriageCount, ownedRegions } from '../src/sim/queries';
import { acceptance, canRival } from '../src/sim/diplomacy';
import { hireMercenaries } from '../src/sim/commands';
import { monthlyScience } from '../src/sim/science';
import { migrateSave, newGame } from '../src/sim/state';
import { dayOf, monthYear, years, yearOf } from '../src/sim/util';
import { effectLines } from '../src/ui/describe';
import { FEET_Y, PLAY_K, TROOP_MIN_FIT, armyAnchor, armyParts, armyScale, nameBox, tokenScale, troopFit } from '../src/ui/map/anchors';
import { regionAt } from '../src/ui/map/geometry';
import { autoSlot, listSaves, saveGame } from '../src/state/storage';
import type { Fleet, GameState } from '../src/sim/types';

// AsyncStorage kept in memory (jest hoists this above the imports).
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const transports = (owner: string, sea: string, n: number): Fleet => ({
  id: `f_${owner}`,
  name: 'Transports',
  owner,
  sea,
  ships: { galley: 0, transport: n, warship: 0 },
  hull: 1,
  path: [],
  progress: 0,
  edgeDays: 0,
});

describe('1. armies march rather than sail when the land route is close', () => {
  test('Castile marches on Granada even with transports in Biscay', () => {
    const s = emptyGame('CAS');
    forceWar(s, 'CAS', 'GRA');
    declareWar(s, 'CAS', 'GRA', 'none');
    s.fleets.f1 = transports('CAS', 'biscay', 5);
    // (From Galicia the sea is still much faster, 17 days against 44, and the army rightly sails.)
    for (const from of ['castile', 'toledo', 'andalusia']) {
      const a = army(s, 'CAS', from, 10);
      const p = findPath(s, a, 'granada');
      expect(p).not.toBeNull();
      expect(p!.path.some(isSea)).toBe(false);
    }
  });

  test('islands still sail', () => {
    const s = emptyGame('ENG');
    const a = army(s, 'ENG', 'wales', 4);
    s.fleets.f1 = transports('ENG', 'irish_sea', 2);
    const p = findPath(s, a, 'pale');
    expect(p).not.toBeNull();
    expect(p!.path.some(isSea)).toBe(true);
  });
});

describe('2. generals have names of their own time and people', () => {
  test('200 Granadan generals: no later-era surnames, full first names', () => {
    const s = emptyGame('GRA');
    const old =
      /Marlborough|Eugene|Turenne|Alba|Wallenstein|Tilly|Montecuccoli|Condé|Vauban|Ruyter|Tromp|Coligny|Guise|Oxenstierna/;
    for (let i = 0; i < 200; i++) {
      const g = newGeneral(s, 'GRA');
      expect(g.name).not.toMatch(old);
      expect(namePool('GRA').some(f => g.name.includes(f))).toBe(true);
    }
    // "Abd al-Rahman" stays whole.
    const names = Array.from({ length: 200 }, () => newGeneral(s, 'GRA').name);
    expect(names.some(n => n.includes('Abd al-Rahman'))).toBe(true);
    expect(names.some(n => /^Abd (?!al-Rahman)/.test(n))).toBe(false);
  });
});

describe('3. regnal numbers follow the real lists', () => {
  test("France's next three Charleses are VIII, IX and X", () => {
    const s = emptyGame('FRA');
    const charles: string[] = [];
    const louis: string[] = [];
    for (let i = 0; i < 400 && charles.length < 3; i++) {
      const p = newPerson(s, 'FRA', 0, 0);
      if (p.name.startsWith('Charles')) charles.push(p.name);
      if (p.name.startsWith('Louis')) louis.push(p.name);
    }
    expect(charles).toEqual(['Charles VIII', 'Charles IX', 'Charles X']);
    if (louis.length) expect(louis[0]).toBe('Louis XI');
  });

  test('English spellings of the 1444 ruler count (Frederick III → Friedrich IV), and numerals have no cap', () => {
    const s = emptyGame('HAB');
    let f: string | undefined;
    for (let i = 0; i < 400 && !f; i++) {
      const p = newPerson(s, 'HAB', 0, 0);
      if (p.name.startsWith('Friedrich')) f = p.name;
    }
    expect(f).toBe('Friedrich IV');
    expect(toRoman(14)).toBe('XIV');
    expect(toRoman(1444)).toBe('MCDXLIV');
  });
});

describe('4. achievements are not earned by accident', () => {
  test('an unnamed rising does not break out in the capital, on top of the army', () => {
    const s = emptyGame('CAS');
    const cap = s.nations.CAS.capital;
    army(s, 'CAS', cap, 20);
    const choice = EVENT.gen_defiant_governor.choices[0];
    const rebels = choice.effects.find(e => 'rebels' in e)!;
    const where = effectRegion(s, 'CAS', rebels);
    expect(where).not.toBe(cap);
    for (const e of choice.effects) applyEffect(s, 'CAS', e);
    const r = Object.values(s.armies).find(a => a.owner === REBELS)!;
    expect(r.node).toBe(where);
    expect(s.regions[r.node].owner).toBe('CAS');
    for (let i = 0; i < 5; i++) advanceDay(s);
    expect(checkAchievements(s)).not.toEqual(expect.arrayContaining(['overwhelming_force']));
  });

  test('nor overseas: a colony rises only when there is nowhere at home', () => {
    const s = emptyGame('CAS');
    Object.assign(s.regions.acadia, { owner: 'CAS', controller: 'CAS', unrest: 10 });
    bumpOwnership();
    const rebels = EVENT.gen_defiant_governor.choices[0].effects.find(e => 'rebels' in e)!;
    const where = effectRegion(s, 'CAS', rebels)!;
    expect(ownedRegions(s, 'CAS').some(r => r.id === 'acadia')).toBe(true);
    expect(where).not.toBe('acadia');
    expect(where).not.toBe(s.nations.CAS.capital);
  });

  test('beating rebels 10:1 sets no record', () => {
    const s = emptyGame('CAS');
    army(s, 'CAS', 'toledo', 30);
    spawnRebels(s, 'toledo', 3);
    for (let i = 0; i < 30 && !s.reports.length; i++) advanceDay(s);
    expect(s.reports.length).toBe(1);
    expect(s.nations.CAS.record.battlesWon).toBe(1);
    expect(s.nations.CAS.record.bestRatio).toBe(0);
    expect(s.nations.CAS.record.stackWipes).toBe(0);
    const got = checkAchievements(s);
    expect(got).not.toContain('overwhelming_force');
    expect(got).not.toContain('not_one_left_standing');
  });
});

describe('6. text slips', () => {
  test('month and year; faith names; a lone attacker "attacks"', () => {
    expect(monthYear(dayOf(1445, 10, 1))).toBe('Nov 1445');
    expect(effectLines({ convertRegion: { region: 'granada', faith: 'catholic' } })[0].text).toBe(
      'Granada becomes Catholic',
    );
    const s = emptyGame('CAS');
    forceWar(s, 'CAS', 'GRA');
    declareWar(s, 'CAS', 'GRA', 'none');
    army(s, 'GRA', 'granada', 4);
    const a = army(s, 'CAS', 'andalusia', 10);
    advanceDay(s);
    a.path = ['granada'];
    for (let i = 0; i < 30 && !s.log.some(l => l.text.startsWith('Battle of Granada:')); i++) advanceDay(s);
    expect(s.log.find(l => l.text.startsWith('Battle of Granada:'))!.text).toMatch(
      /^Battle of Granada: Castile attacks Granada/,
    );
  });
});

describe('7. a generic card does not come back within 10 years', () => {
  test('fired once, it is not eligible again for 10 years', () => {
    const s = emptyGame('POR');
    delete s.flags.__noEvents;
    const year = () => yearOf(s.day);
    const e = EVENTS.find(x => x.pool === 'generic' && !x.window && !x.nations && eligible(s, 'FRA', x, year()))!;
    expect(e).toBeDefined();
    fireEvent(s, 'FRA', e);
    s.day += years(3);
    expect(eligible(s, 'FRA', e, year())).toBe(false);
    s.day += years(8);
    expect(eligible(s, 'FRA', e, year())).toBe(true);
  });
});

describe('8. one autosave per campaign', () => {
  test('two campaigns keep two autosaves; a fourth drops the oldest; old saves keep the old slot', async () => {
    let clock = 1_000_000;
    const now = jest.spyOn(Date, 'now').mockImplementation(() => ++clock);
    const game = (player: string, campaign: string): GameState => newGame({ player, seed: 3, campaign });
    try {
      await saveGame('auto', game('FRA', 'a'));
      await saveGame('auto', game('CAS', 'b'));
      let autos = (await listSaves()).filter(m => m.slot.startsWith('auto'));
      expect(autos.map(m => m.slot).sort()).toEqual(['auto-a', 'auto-b']);
      await saveGame('auto', game('ENG', 'c'));
      await saveGame('auto', game('POR', 'd'));
      autos = (await listSaves()).filter(m => m.slot.startsWith('auto'));
      expect(autos.map(m => m.slot).sort()).toEqual(['auto-b', 'auto-c', 'auto-d']);
      expect(await AsyncStorage.getItem('coe.save.auto-a')).toBeNull();
      // A save from before campaigns had ids still autosaves to the one old slot.
      const old = JSON.parse(JSON.stringify(newGame({ player: 'FRA', seed: 3 })));
      expect(autoSlot(migrateSave(old)!)).toBe('auto');
    } finally {
      now.mockRestore();
    }
  });
});

describe('11. a scattered army: the report and the log agree', () => {
  test('casualties include the scattered men, and the log gives both numbers', () => {
    const s = emptyGame('VEN');
    forceWar(s, 'TUR', 'VEN');
    const tur = army(s, 'TUR', 'candia', 6);
    army(s, 'VEN', 'candia', 10);
    advanceDay(s);
    tur.morale *= 0.3;
    declareWar(s, 'TUR', 'VEN', 'none');
    for (let i = 0; i < 30 && !s.reports.length; i++) advanceDay(s);
    const r = s.reports[0];
    const lost = 1 - r.winner;
    expect(r.scattered).toBe(true);
    expect(r.scatteredMen).toBeGreaterThan(0);
    expect(r.losses[lost]).toBeGreaterThanOrEqual(r.scatteredMen!);
    const line = s.log.find(l => / more men lost \(/.test(l.text))!;
    expect(line.text).toContain(
      `${r.scatteredMen!.toLocaleString()} more men lost (${r.losses[lost].toLocaleString()} in all)`,
    );
  });
});

describe('12. no mercenaries under an enemy army', () => {
  test('refused with a reason, and no gold spent', () => {
    const s = emptyGame('FRA');
    forceWar(s, 'FRA', 'ENG');
    declareWar(s, 'ENG', 'FRA', 'none');
    army(s, 'ENG', 'champagne', 19);
    s.nations.FRA.gold = 1000;
    const r = hireMercenaries(s, 'champagne', 4);
    expect(r.ok).toBe(false);
    expect(r.msg).toMatch(/enemy army/);
    expect(s.nations.FRA.gold).toBe(1000);
    expect(hireMercenaries(s, 'orleans', 4).ok).toBe(true);
  });
});

describe('13. a conquest follow-up comes the day the peace is signed', () => {
  test('Castile takes Granada: the card is waiting after one day', () => {
    const s = emptyGame('CAS');
    delete s.flags.__noEvents;
    forceWar(s, 'CAS', 'GRA');
    const w = declareWar(s, 'CAS', 'GRA', 'none')!;
    makePeace(s, w, { regions: ['granada'], gold: 0, vassalize: false, release: [], winner: 'CAS', loser: 'GRA' });
    expect(s.regions.granada.owner).toBe('CAS');
    advanceDay(s);
    expect(s.pendingEvents.map(p => p.event)).toContain('cas_fall_of_granada');
    expect(s.flags._peaceToday).toBeUndefined();
  });
});

describe('14. old friends do not become rivals', () => {
  test('Castile and Aragon start as friends, not rivals, and cannot rival each other', () => {
    const s = newGame({ player: 'POR', seed: 1 });
    expect(s.nations.CAS.rivals).not.toContain('ARA');
    expect(s.nations.ARA.rivals).not.toContain('CAS');
    expect(canRival(s, 'ARA', 'CAS')).toMatch(/old friend/);
    expect(canRival(s, 'CAS', 'ARA')).toMatch(/old friend/);
  });
});

describe('16. science never sits idle', () => {
  test('after an advance, the player studies the next one in the same track', () => {
    const s = emptyGame('FRA');
    const nat = s.nations.FRA;
    const war = Object.values(ADVANCE)
      .filter(a => a.field === 'war' && !nat.advances.includes(a.id) && a.requires.every(r => nat.advances.includes(r)))
      .sort((a, b) => a.year - b.year)[0];
    nat.researching = war.id;
    nat.science = 1e6;
    monthlyScience(s);
    expect(nat.advances).toContain(war.id);
    expect(nat.researching).not.toBeNull();
    expect(ADVANCE[nat.researching!].field).toBe('war');
    expect(s.log.some(l => l.text.startsWith('Your scholars turn to'))).toBe(true);
  });
});

describe('17. at most four royal marriages per house', () => {
  test('a house at the cap refuses, and the 1444 marriages stand', () => {
    const s = emptyGame('POR');
    const before = marriageCount(s, 'FRA');
    for (const o of ['SCO', 'NAV', 'SAV', 'BRI', 'PRO', 'LOR'])
      if (marriageCount(s, 'ENG') < MAX_MARRIAGES) s.marriages[['ENG', o].sort().join('|')] = s.day;
    expect(marriageCount(s, 'ENG')).toBe(MAX_MARRIAGES);
    const suitor = ['DAN', 'POL', 'HUN', 'BOH', 'SWE'].find(n => !(['ENG', n].sort().join('|') in s.marriages))!;
    const acc = acceptance(s, suitor, 'ENG', 'marriage');
    expect(acc.accept).toBe(false);
    expect(acc.blocked).toBe('Their house already has four royal marriages.');
    expect(marriageCount(s, 'FRA')).toBe(before);
  });

  test('a house at the cap can neither ask nor be asked (the AI marries only through this check)', () => {
    const s = emptyGame('POR');
    const free = (n: string) =>
      NATION[n]?.gov === 'monarchy' && n !== 'ENG' && !(['ENG', n].sort().join('|') in s.marriages);
    const monarchies = Object.keys(s.nations).filter(free);
    for (const o of monarchies)
      if (marriageCount(s, 'ENG') < MAX_MARRIAGES) s.marriages[['ENG', o].sort().join('|')] = s.day;
    expect(marriageCount(s, 'ENG')).toBe(MAX_MARRIAGES);
    const rest = Object.keys(s.nations).filter(free);
    expect(rest.length).toBeGreaterThan(5);
    for (const o of rest) {
      expect(acceptance(s, o, 'ENG', 'marriage').accept).toBe(false);
      expect(acceptance(s, 'ENG', o, 'marriage').accept).toBe(false);
    }
    expect(acceptance(s, 'ENG', 'DAN', 'marriage').blocked).toBe(
      'Your house has no one left to marry: at most four royal marriages.',
    );
  });
});

describe('10. army tokens stand on their own land', () => {
  test("Granada's and Fez's armies stand inside their regions at every zoom", () => {
    for (const id of ['granada', 'fez'])
      for (const k of [1.3, 1.5, 1.7, 2.5, 4]) {
        const [x, y] = armyAnchor(id, k);
        expect(regionAt(x, y + (FEET_Y * armyScale(id, k)) / k)).toBe(id);
      }
  });

  test("troops are smaller in a small region, as its town is, and full size in a big one", () => {
    expect(troopFit('castile', PLAY_K)).toBe(1);
    expect(armyScale('castile', PLAY_K)).toBe(tokenScale(PLAY_K));
    for (const id of ['rome', 'ferrara', 'siena', 'tuscany', 'constantinople']) {
      expect(troopFit(id, PLAY_K)).toBeLessThan(0.8);
      expect(troopFit(id, PLAY_K)).toBeGreaterThanOrEqual(TROOP_MIN_FIT);
      // Never smaller as you zoom out; full size close in.
      expect(troopFit(id, 1.2)).toBe(troopFit(id, PLAY_K));
      expect(troopFit(id, 8)).toBe(1);
    }
  });

  test("in the opening view the Pope's and Ferrara's troops keep off Umbria's and the Veneto's names", () => {
    // They stood over most of them, rising above their own small regions' names; now a banner's tip at most, under the letters.
    const px = (n: number) => n / PLAY_K;
    const area = (a: number[], b: number[]) =>
      Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    for (const [id, other] of [['rome', 'umbria'], ['ferrara', 'veneto']]) {
      const name = nameBox(other, PLAY_K, px)!;
      const covered = armyParts(id, PLAY_K).reduce((t, b) => t + area(b, name), 0) / area(name, name);
      expect([id, other, covered < 0.15]).toEqual([id, other, true]);
    }
  });
});
