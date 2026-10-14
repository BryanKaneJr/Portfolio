import { emptyGame, forceWar } from './helpers';
import { MAX_MONTHLY, MAX_TARGET, dailyWarRolls, debugAI, warOdds } from '../src/sim/ai';
import { isNativeNation } from '../src/sim/content';
import { ledger, maxManpower } from '../src/sim/economy';
import { hasTruce } from '../src/sim/queries';
import { newGame } from '../src/sim/state';
import { killNation } from '../src/sim/territory';
import type { GameState, NationId } from '../src/sim/types';
import { dateOf, pairKey, rand, years } from '../src/sim/util';
import { declareWar, leaveWar, makePeace } from '../src/sim/war';

const factor = (o: ReturnType<typeof warOdds>, key: string) => o.factors.find(f => f.key === key)?.x;

describe('the war roll: once a month, each crown on a day of its own', () => {
  /** 800 days of rolls with every crown kept resting (so no roll draws more than its next day). */
  function rolls(seed: number) {
    const s = newGame({ player: 'POR', seed });
    for (const nat of Object.values(s.nations)) nat.ai.lastPeace = s.day + years(100);
    const days: Record<NationId, number[]> = {};
    const off: string[] = [];
    for (let i = 0; i < 800; i++) {
      s.day++;
      const before = Object.fromEntries(Object.values(s.nations).map(n => [n.id, n.ai.warRoll]));
      dailyWarRolls(s);
      for (const nat of Object.values(s.nations)) {
        const v = before[nat.id];
        if (v === undefined || nat.ai.warRoll === v) continue;
        if (s.day !== v) off.push(`${nat.id} rolled on ${s.day}, due ${v}`);
        (days[nat.id] ??= []).push(s.day);
      }
    }
    return { s, days, off };
  }

  test('every AI crown rolls exactly once in every calendar month, March included, on days spread over the month', () => {
    const { s, days, off } = rolls(2);
    expect(off).toEqual([]);
    const crowns = Object.values(s.nations).filter(n => n.alive && !isNativeNation(n.id) && n.id !== s.player);
    expect(crowns.length).toBeGreaterThan(50);
    const months: [number, number][] = [[1444, 11]];
    for (let y = 1445; y <= 1446; y++) for (let m = 0; m < 12; m++) months.push([y, m]);
    for (const [y, m] of months) {
      const spread = new Set<number>();
      for (const nat of crowns) {
        const inMonth = (days[nat.id] ?? []).filter(d => dateOf(d).year === y && dateOf(d).month === m);
        expect(inMonth.length).toBe(1);
        spread.add(dateOf(inMonth[0]).day);
      }
      expect(spread.size).toBeGreaterThanOrEqual(15);
    }
    // March too (the monthly pass skips it).
    for (const nat of crowns) expect(days[nat.id].filter(d => dateOf(d).month === 2)).toHaveLength(2);
    // The player's own crown never rolls.
    expect(days[s.player]).toBeUndefined();
  });

  test('the days replay exactly, survive a save, and a missing day is drawn without a roll', () => {
    const a = rolls(2);
    const b = rolls(2);
    expect(b.days).toEqual(a.days);
    const s = a.s;
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    for (const nat of Object.values(s.nations)) expect(copy.nations[nat.id].ai.warRoll).toBe(nat.ai.warRoll);
    // ...and the saved game rolls on the same days, with the same draws, as the one never saved.
    for (let i = 0; i < 60; i++) {
      s.day++;
      copy.day++;
      dailyWarRolls(s);
      dailyWarRolls(copy);
    }
    expect(copy.rng).toBe(s.rng);
    for (const nat of Object.values(s.nations)) expect(copy.nations[nat.id].ai.warRoll).toBe(nat.ai.warRoll);
    // An older save (or a new game): the day is drawn in the next calendar month, and that is all that happens.
    for (const nat of Object.values(s.nations)) nat.ai.warRoll = s.day + 1000;
    const cas = s.nations.CAS;
    cas.ai.lastPeace = s.day - years(10);
    delete cas.ai.warRoll;
    const r0 = s.rng;
    dailyWarRolls(s);
    const probe = { rng: r0 } as GameState;
    rand(probe);
    expect(s.rng).toBe(probe.rng); // one draw: the day
    const now = dateOf(s.day);
    const next = dateOf(cas.ai.warRoll!);
    expect(next.month).toBe((now.month + 1) % 12);
    expect(next.year).toBe(now.month === 11 ? now.year + 1 : now.year);
  });
});

describe('the war chance', () => {
  /** Seed 1 in 1444, the AI playing everyone, the named crowns (all if none) long rested. */
  function game(rested?: NationId[]) {
    const s = newGame({ player: 'POR', seed: 1 });
    s.flags.__spectate = 1;
    for (const nat of Object.values(s.nations)) if (!rested || rested.includes(nat.id)) nat.ai.lastPeace = s.day - years(10);
    return s;
  }

  test('the Ottomans on Byzantium: at the cap', () => {
    const s = game(['TUR']);
    const o = warOdds(s, 'TUR');
    expect(o.best?.target).toBe('BYZ');
    expect(o.best?.cb.cb).toBe('claim');
    expect(o.yearly).toBeGreaterThan(1200 * MAX_MONTHLY);
    expect(o.monthly).toBe(MAX_MONTHLY);
    expect(o.best?.empire).toBe(1);
  });

  test('the month’s chance is the year’s ÷ 12, never above the cap, and no target multiplies by more than MAX_TARGET', () => {
    const s = game();
    let withTarget = 0;
    for (const nat of Object.values(s.nations)) {
      if (!nat.alive || isNativeNation(nat.id)) continue;
      const o = warOdds(s, nat.id);
      expect(o.monthly).toBe(Math.min(MAX_MONTHLY, o.yearly / 1200));
      expect(o.monthly).toBeLessThanOrEqual(MAX_MONTHLY);
      if (!o.best) continue;
      withTarget++;
      expect(o.best.edge * o.best.reason * o.best.want * o.best.empire).toBeLessThanOrEqual(MAX_TARGET);
      expect(o.best.ratio).toBeGreaterThanOrEqual(o.best.need);
    }
    expect(withTarget).toBeGreaterThan(5);
  });

  test('Castile’s factors', () => {
    const base = warOdds(game(['CAS']), 'CAS');
    expect(base.best?.target).toBe('GRA');
    expect(base.monthly).toBeLessThan(MAX_MONTHLY); // not capped, so each factor shows in it
    const odds = (change: (s: GameState) => void) => {
      const s = game(['CAS']);
      change(s);
      return warOdds(s, 'CAS');
    };
    const debts = odds(s => (s.nations.CAS.loans = 2));
    expect(factor(debts, 'debt')).toBeCloseTo(0.7, 3);
    expect(debts.monthly).toBeCloseTo(base.monthly * 0.7, 9);
    expect(factor(odds(s => (s.nations.CAS.stability = 3)), 'order')).toBeCloseTo(1.2, 3);
    expect(factor(odds(s => (s.nations.CAS.warExhaustion = 5)), 'weariness')).toBeCloseTo(0.5, 3);
    expect(factor(odds(s => (s.nations.CAS.manpower = 0)), 'levies')).toBeCloseTo(0.4, 3);
    expect(factor(odds(s => (s.nations.CAS.manpower = maxManpower(s, 'CAS'))), 'levies')).toBeCloseTo(1.2, 3);
    expect(factor(odds(s => (s.nations.CAS.gold = 0)), 'treasury')).toBeCloseTo(0.5, 3);
    expect(factor(odds(s => (s.nations.CAS.gold = 10 * (40 + 4 * Math.max(0, s.nations.CAS.lastMonthIncome)))), 'treasury')).toBeCloseTo(1.5, 3);
    // Before the first month's books (a new game), the reserve counts the income that month will record.
    const fresh = game(['CAS']);
    expect(fresh.nations.CAS.lastMonthIncome).toBe(0);
    const reserve = 40 + 4 * ledger(fresh, 'CAS').totalIncome;
    expect(factor(warOdds(fresh, 'CAS'), 'treasury')).toBeCloseTo(Math.min(1.5, 0.5 + (0.5 * fresh.nations.CAS.gold) / reserve), 9);
    expect(factor(odds(s => (s.nations.CAS.ruler.traits = ['warrior'])), 'ruler')).toBeCloseTo(1.25, 3);
    expect(factor(odds(s => (s.nations.CAS.ruler.traits = ['craven'])), 'ruler')).toBeCloseTo(0.6, 3);
    expect(factor(odds(s => ((s.nations.CAS.ruler.traits = []), (s.nations.CAS.ruler.regency = true))), 'ruler')).toBeCloseTo(0.6, 3);
    expect(factor(odds(s => s.coalitions.push({ target: 'CAS', members: ['ARA', 'POR'], formed: s.day })), 'feared')).toBeCloseTo(0.5, 3);
    expect(factor(odds(s => (s.nations.CAS.ai.lastPeace = s.day - years(2.25))), 'rest')).toBeCloseTo(0.5, 2);
  });

  test('the hard gates: debts, order, war exhaustion, rest, a war', () => {
    const gate = (change: (s: GameState) => void) => {
      const s = game(['CAS']);
      change(s);
      return warOdds(s, 'CAS');
    };
    const expectBlocked = (o: ReturnType<typeof warOdds>, why: string) => {
      expect(o.blocked).toBe(why);
      expect(o.monthly).toBe(0);
      expect(o.best).toBeUndefined();
    };
    expectBlocked(gate(s => (s.nations.CAS.loans = 4)), 'debt');
    expectBlocked(gate(s => (s.nations.CAS.stability = -1)), 'order');
    expectBlocked(gate(s => (s.nations.CAS.warExhaustion = 5.1)), 'weariness');
    let last = 0;
    const resting = gate(s => (last = s.nations.CAS.ai.lastPeace = s.day - years(1.4)));
    expectBlocked(resting, 'rest');
    expect(resting.restUntil).toBe(last + years(1.5));
    expectBlocked(
      gate(s => {
        forceWar(s, 'CAS', 'GRA');
        declareWar(s, 'CAS', 'GRA', 'claim', 'granada');
      }),
      'war',
    );
  });

  test('a neighbour under truce is never the target', () => {
    const s = game(['TUR', 'CAS']);
    expect(hasTruce(s, 'TUR', 'HUN') && hasTruce(s, 'TUR', 'POL')).toBe(true);
    expect(['HUN', 'POL']).not.toContain(warOdds(s, 'TUR').best?.target);
    // The last day of the shorter truce (late 1448): still never the target.
    const t = s.day;
    s.day = Math.min(s.truces[pairKey('TUR', 'HUN')], s.truces[pairKey('TUR', 'POL')]) - 1;
    expect(hasTruce(s, 'TUR', 'HUN') && hasTruce(s, 'TUR', 'POL')).toBe(true);
    expect(['HUN', 'POL']).not.toContain(warOdds(s, 'TUR').best?.target);
    s.day = t;
    s.truces[pairKey('CAS', 'GRA')] = s.day + years(5);
    expect(warOdds(s, 'CAS').best?.target).not.toBe('GRA');
  });

  test('a crown with a claim on a neighbour whose truce ends within two years waits for that war', () => {
    const s = game(['FRA']);
    const truce = s.truces[pairKey('ENG', 'FRA')];
    expect('normandy' in s.nations.FRA.claims).toBe(true);
    // Four years to go: France weighs other wars.
    expect(warOdds(s, 'FRA').blocked).toBeUndefined();
    // Under two: it keeps its powder dry for England, and draws nothing.
    s.day = truce - years(1.5);
    const o = warOdds(s, 'FRA');
    expect(o.blocked).toBe('waiting');
    expect(o.waitingFor).toBe('ENG');
    expect(o.restUntil).toBe(truce);
    const r0 = s.rng;
    debugAI.aiWar(s, s.nations.FRA);
    expect(s.rng).toBe(r0);
    // Once the truce is over, England is a target like any other.
    s.day = truce + 1;
    expect(warOdds(s, 'FRA').blocked).toBeUndefined();
  });

  test('no waiting for a war it could never declare, nor for a claim that lapses first', () => {
    const s = game(['FRA']);
    const fra = s.nations.FRA;
    delete s.truces[pairKey('ENG', 'FRA')];
    // A truce with its own vassal, Provence, over a claim on Provence's land: never a war, so no wait.
    expect(s.nations.PRO.overlord).toBe('FRA');
    fra.claims.provence = -1;
    s.truces[pairKey('FRA', 'PRO')] = s.day + years(1);
    expect(warOdds(s, 'FRA').blocked).toBeUndefined();
    // A claim on England's land that lapses before the truce with England ends: nothing to wait for.
    fra.claims = { normandy: s.day + years(0.5) };
    s.truces[pairKey('ENG', 'FRA')] = s.day + years(1);
    expect(warOdds(s, 'FRA').blocked).toBeUndefined();
    // The same claim lasting past the truce: France waits for England.
    fra.claims = { normandy: s.day + years(5) };
    expect(warOdds(s, 'FRA').waitingFor).toBe('ENG');
  });

  test('the Emperor’s peace between members of the Empire', () => {
    const s = game(['BRA']);
    const o = warOdds(s, 'BRA');
    expect(o.best?.target).toBe('POM');
    expect(o.best?.empire).toBe(0.3);
    s.nations.BRA.claims.pomerania = -1;
    const c = warOdds(s, 'BRA');
    expect(c.best?.cb.cb).toBe('claim');
    expect(c.best?.empire).toBe(0.6);
  });
});

describe('the roll', () => {
  test('a draw just under the month’s chance declares, just over it does nothing', () => {
    const s = newGame({ player: 'POR', seed: 1 });
    s.flags.__spectate = 1;
    const cas = s.nations.CAS;
    cas.ai.lastPeace = s.day - years(10);
    const m = warOdds(s, 'CAS').monthly;
    debugAI.aiWar(s, cas, m + 1e-9);
    expect(Object.values(s.wars).some(w => w.attackers[0] === 'CAS')).toBe(false);
    debugAI.aiWar(s, cas, m - 1e-9);
    const w = Object.values(s.wars).find(x => x.attackers[0] === 'CAS');
    expect(w?.defenders[0]).toBe('GRA');
    expect(w?.cb).toBe('claim');
    expect(w?.limited).toBe(true);
    expect(w?.origin).toBe('ai');
  });

  test('a crown that may not go to war makes no draw', () => {
    const s = newGame({ player: 'POR', seed: 1 });
    s.flags.__spectate = 1;
    forceWar(s, 'CAS', 'GRA');
    declareWar(s, 'CAS', 'GRA', 'claim', 'granada');
    const r0 = s.rng;
    debugAI.aiWar(s, s.nations.CAS);
    expect(s.rng).toBe(r0);
    s.nations.FRA.ai.lastPeace = s.day - years(1);
    debugAI.aiWar(s, s.nations.FRA);
    expect(s.rng).toBe(r0);
  });
});

describe('rest after every war', () => {
  test('a declaration, a peace, a separate peace and a war ending without one all start a rest', () => {
    const s = emptyGame('POR');
    s.day += 40;
    forceWar(s, 'FRA', 'BUR');
    s.nations.BUR.ai.lastWarDeclared = 5;
    const w = declareWar(s, 'FRA', 'BUR', 'none')!;
    expect(s.nations.FRA.ai.lastWarDeclared).toBe(s.day);
    expect(s.nations.BUR.ai.lastWarDeclared).toBe(5);
    // Everyone in it rests after the peace, allies too.
    if (!w.attackers.includes('SCO')) w.attackers.push('SCO');
    makePeace(s, w, { regions: [], gold: 0, vassalize: false, release: [], white: true, winner: 'FRA', loser: 'BUR' });
    for (const n of ['FRA', 'BUR', 'SCO']) expect(s.nations[n].ai.lastPeace).toBe(s.day);

    // A loser made a vassal in the peace (which takes it out of the war first) rests too.
    s.day += 40;
    forceWar(s, 'VEN', 'MLO');
    const wv = declareWar(s, 'VEN', 'MLO', 'none')!;
    s.nations.MLO.ai.lastPeace = 0;
    makePeace(s, wv, { regions: [], gold: 0, vassalize: true, release: [], white: false, winner: 'VEN', loser: 'MLO' });
    expect(s.nations.MLO.overlord).toBe('VEN');
    expect(s.nations.MLO.ai.lastPeace).toBe(s.day);

    s.day += 40;
    forceWar(s, 'FRA', 'BUR');
    delete s.truces[pairKey('SCO', 'BUR')];
    const w2 = declareWar(s, 'FRA', 'BUR', 'none')!;
    if (!w2.attackers.includes('SCO')) w2.attackers.push('SCO');
    leaveWar(s, w2, 'SCO');
    expect(s.nations.SCO.ai.lastPeace).toBe(s.day);
    expect(s.truces[pairKey('SCO', 'BUR')]).toBe(s.day + years(5));

    s.day += 40;
    w2.attackers = ['FRA'];
    w2.defenders = ['BUR'];
    s.nations.FRA.ai.lastPeace = 0;
    killNation(s, 'BUR', 'FRA');
    expect(s.wars[w2.id]).toBeUndefined();
    expect(s.nations.FRA.ai.lastPeace).toBe(s.day);
  });
});
