/** Fun batch 2, war: storming the walls, humbling the loser, reparations. */
import { emptyGame, army, forceWar } from './helpers';
import { STORM_MEN_PER_FORT, STORM_SETBACK, aiStorms, storm, stormOdds } from '../src/sim/siege';
import {
  HUMBLE_COST,
  REPARATIONS_SHARE,
  buildDemands,
  declareWar,
  fitTerms,
  humbleRenown,
  makePeace,
  peaceAcceptance,
  peaceCost,
  reparationsCost,
} from '../src/sim/war';
import { incomeBase, ledger, monthlyEconomy, reparationsOf } from '../src/sim/economy';
import { acceptedTerms } from '../src/sim/ai';
import { stormWalls } from '../src/sim/commands';
import { advanceDays } from '../src/sim/tick';
import { migrateSave } from '../src/sim/state';
import { armyMen, nationMods } from '../src/sim/queries';
import type { Army, GameState, NationId, PeaceTerms, War } from '../src/sim/types';
import { transferRegion } from '../src/sim/territory';
import { rand, years } from '../src/sim/util';

/** Sets the generator so that the next roll comes out under `p` (true) or at or over it (false). */
function forceRoll(s: GameState, p: number, under: boolean) {
  for (let seed = 1; seed < 100000; seed++) {
    const probe = { rng: seed } as GameState;
    if (rand(probe) < p === under) {
      s.rng = seed;
      return;
    }
  }
  throw new Error('no seed found');
}

/** France besieges Burgundy's level `fort` fort with `inf` infantry and `art` guns; the siege `days` old at `progress`. */
function siegeAt(fort: number, inf: number, art: number, progress: number, days = 40, player: NationId = 'ENG') {
  const s = emptyGame(player);
  forceWar(s, 'FRA', 'BUR');
  declareWar(s, 'FRA', 'BUR', 'none');
  s.regions.burgundy.fort = fort;
  const a = army(s, 'FRA', 'burgundy', inf, 0, art);
  advanceDays(s, 1);
  const reg = s.regions.burgundy;
  reg.siege = { by: 'FRA', progress, started: s.day - days };
  return { s, a, reg };
}

const general = (a: Army, stars: number) => (a.general = { id: 'gx', name: 'Test', stars, hired: 0, lifespan: 99999 });

describe('storm the walls: the odds', () => {
  test('the worked example: half done, 2 guns, 3 spare regiments, a 2-star general is 62%', () => {
    const { s, a } = siegeAt(2, 7, 2, 0.5);
    general(a, 2);
    const o = stormOdds(s, 'burgundy')!;
    expect(o.blocked).toBeNull();
    expect(o.by).toBe('FRA');
    expect(Math.round(o.chance * 100)).toBe(62);
    expect(o.men).toBe(2 * STORM_MEN_PER_FORT);
    expect(o.parts.reduce((t, p) => t + p.value, 0)).toBe(62);
  });

  test('85% at most, 5% at least', () => {
    const big = siegeAt(1, 20, 10, 0.95);
    general(big.a, 5);
    expect(stormOdds(big.s, 'burgundy')!.chance).toBe(0.85);
    const small = siegeAt(1, 3, 0, 0);
    expect(stormOdds(small.s, 'burgundy')!.chance).toBe(0.05);
  });

  test('each reason it cannot be done yet', () => {
    const noFort = siegeAt(1, 6, 0, 0.5);
    noFort.reg.fort = 0;
    expect(stormOdds(noFort.s, 'burgundy')!.blocked).toBe('No walls to storm');
    const short = siegeAt(3, 6, 0, 0.5);
    expect(stormOdds(short.s, 'burgundy')!.blocked).toBe('Needs 9 regiments');
    const young = siegeAt(2, 6, 0, 0.2, 10);
    expect(stormOdds(young.s, 'burgundy')!.blocked).toBe('Siege only 10 days old');
    const again = siegeAt(2, 6, 0, 0.5);
    again.reg.siege!.stormed = again.s.day - 12;
    expect(stormOdds(again.s, 'burgundy')!.blocked).toBe('Ready again in 18 days');
    const fight = siegeAt(2, 6, 0, 0.5);
    fight.a.battle = 'b1';
    expect(stormOdds(fight.s, 'burgundy')!.blocked).toBe('Battle under way');
  });

  test('null where nobody besieges anything', () => {
    const s = emptyGame('ENG');
    expect(stormOdds(s, 'burgundy')).toBeNull();
  });
});

describe('storm the walls: the roll', () => {
  test('won: the fort falls and 750 men per level are lost', () => {
    const { s, a, reg } = siegeAt(2, 8, 0, 0.5);
    const before = armyMen(a);
    const we = s.nations.FRA.warExhaustion;
    forceRoll(s, stormOdds(s, 'burgundy')!.chance, true);
    expect(storm(s, 'burgundy')).toBe('won');
    expect(reg.controller).toBe('FRA');
    expect(before - armyMen(a)).toBe(1500);
    expect(s.nations.FRA.warExhaustion).toBeCloseTo(we + 0.15, 5);
  });

  test('lost: progress falls back, the same men are lost, and no second storm for 30 days', () => {
    const { s, a, reg } = siegeAt(2, 8, 0, 0.5);
    const before = armyMen(a);
    forceRoll(s, stormOdds(s, 'burgundy')!.chance, false);
    expect(storm(s, 'burgundy')).toBe('lost');
    expect(reg.controller).toBe('BUR');
    expect(reg.siege!.progress).toBeCloseTo(0.5 - STORM_SETBACK, 5);
    expect(before - armyMen(a)).toBe(1500);
    expect(storm(s, 'burgundy')).toBeNull();
    expect(stormOdds(s, 'burgundy')!.blocked).toBe('Ready again in 30 days');
  });

  test('men are taken from every besieging army by its men', () => {
    const { s, a } = siegeAt(3, 6, 0, 0.5);
    const b = army(s, 'FRA', 'burgundy', 2, 0, 1); // 2,000 infantry and 1,000 gunners beside 6,000 men
    const [ma, mb] = [armyMen(a), armyMen(b)];
    forceRoll(s, 0.5, false);
    storm(s, 'burgundy');
    expect(ma - armyMen(a)).toBe(1500);
    expect(mb - armyMen(b)).toBe(750);
    expect(b.regs.inf.men).toBe(2000 - 500);
    expect(b.regs.art.men).toBe(1000 - 250);
  });

  test('the player storms by command, and their men lost are counted', () => {
    const { s, reg } = siegeAt(2, 8, 0, 0.5, 40, 'FRA');
    const lost = s.stats.menLost;
    forceRoll(s, stormOdds(s, 'burgundy')!.chance, false);
    const r = stormWalls(s, 'burgundy');
    expect(r.ok).toBe(true);
    expect(r.msg).toBe('Thrown back from the walls (−1,500 men).');
    expect(s.stats.menLost - lost).toBe(1500);
    expect(reg.siege!.stormed).toBe(s.day);
    expect(stormWalls(s, 'burgundy').ok).toBe(false);
  });

  test('the player may not storm a siege someone else leads', () => {
    const { s } = siegeAt(2, 8, 0, 0.5, 40, 'ENG');
    expect(stormWalls(s, 'burgundy').ok).toBe(false);
  });

  test('the AI storms at 75% or better, and not below', () => {
    const low = siegeAt(1, 3, 0, 0.5); // 5 + 35 = 40%
    aiStorms(low.s, low.s.nations.FRA);
    expect(low.reg.siege!.stormed).toBeUndefined();
    expect(low.reg.controller).toBe('BUR');
    const high = siegeAt(1, 8, 5, 0.9); // 5 + 63 + 25 + 10 → 85%
    forceRoll(high.s, 0.85, true);
    aiStorms(high.s, high.s.nations.FRA);
    expect(high.reg.controller).toBe('FRA');
  });
});

/** France at war with Burgundy, holding some of its land, for the peace table. */
function warFraBur(): { s: GameState; w: War } {
  const s = emptyGame('ENG');
  forceWar(s, 'FRA', 'BUR');
  const w = declareWar(s, 'FRA', 'BUR', 'none')!;
  return { s, w };
}
const deal = (extra: Partial<PeaceTerms> = {}): PeaceTerms => ({ regions: [], gold: 0, vassalize: false, release: [], winner: 'FRA', loser: 'BUR', ...extra });

describe('humble them', () => {
  test('costs 15% leverage, nothing in a white peace', () => {
    const { s } = warFraBur();
    expect(peaceCost(s, deal({ gold: 100, humble: true })) - peaceCost(s, deal({ gold: 100 }))).toBe(HUMBLE_COST);
    expect(peaceCost(s, deal({ white: true, humble: true }))).toBe(0);
  });

  test('renown moves from the loser to the winner, more against a rival', () => {
    for (const rival of [false, true]) {
      const { s, w } = warFraBur();
      s.nations.FRA.rivals = rival ? ['BUR'] : [];
      s.nations.FRA.prestige = 20;
      s.nations.BUR.prestige = 60;
      const gain = nationMods(s, 'FRA').prestigeGain;
      makePeace(s, w, deal({ gold: 10, humble: true }));
      const base = rival ? 20 : 15;
      expect(humbleRenown(s, 'FRA', 'BUR')).toBe(base);
      expect(s.nations.FRA.prestige).toBeCloseTo(20 + ((rival ? 20 : 10) + base) * (1 + gain), 5);
      expect(s.nations.BUR.prestige).toBe(60 - 10 - base);
    }
  });

  test('the AI humbles a rival only, with leverage to spare', () => {
    const { s, w } = warFraBur();
    s.nations.BUR.gold = 0;
    s.nations.FRA.rivals = [];
    expect(buildDemands(s, w, 'FRA', 60).humble).toBeFalsy();
    s.nations.FRA.rivals = ['BUR'];
    expect(buildDemands(s, w, 'FRA', 60).humble).toBe(true);
    expect(buildDemands(s, w, 'FRA', 10).humble).toBeFalsy();
  });
});

describe('reparations', () => {
  test('cost: 1.2% per gold of monthly income, 5% to 25%', () => {
    const { s } = warFraBur();
    const base = incomeBase(s, 'BUR');
    expect(reparationsCost(s, 'BUR')).toBe(Math.min(25, Math.max(5, Math.round(base * 1.2))));
    const lands = Object.values(s.regions).filter(r => r.owner === 'BUR');
    for (const r of lands.slice(1)) transferRegion(s, r.id, 'FRA');
    lands[0].dev = 1;
    expect(reparationsCost(s, 'BUR')).toBe(5);
    lands[0].dev = 200;
    expect(reparationsCost(s, 'BUR')).toBe(25);
    expect(peaceCost(s, deal({ reparations: true }))).toBe(25);
    expect(peaceCost(s, deal({ reparations: true, vassalize: true }))).toBe(peaceCost(s, deal({ vassalize: true })));
  });

  test('a peace sets them, and both sides’ books show the same sum', () => {
    const { s, w } = warFraBur();
    makePeace(s, w, deal({ reparations: true }));
    expect(s.nations.BUR.reparations).toEqual({ to: 'FRA', until: s.day + years(10) });
    const paid = ledger(s, 'BUR').expenses.find(e => e.label.startsWith('Reparations to France'))!;
    const got = ledger(s, 'FRA').income.find(e => e.label === 'Reparations from Burgundy')!;
    expect(paid.value).toBeGreaterThan(0);
    expect(paid.value).toBeCloseTo(got.value, 9);
    expect(paid.value).toBeCloseTo(incomeBase(s, 'BUR') * REPARATIONS_SHARE, 9);
  });

  test('never with a vassal', () => {
    const { s, w } = warFraBur();
    makePeace(s, w, deal({ reparations: true, vassalize: true }));
    expect(s.nations.BUR.reparations).toBeUndefined();
  });

  test('they end on their day, on subjugation, and in a war between the two', () => {
    const run = (setup: (s: GameState) => void) => {
      const { s, w } = warFraBur();
      makePeace(s, w, deal({ reparations: true }));
      setup(s);
      monthlyEconomy(s);
      return s.nations.BUR.reparations;
    };
    expect(run(() => {})).toBeDefined();
    expect(run(s => (s.day += years(10)))).toBeUndefined();
    expect(run(s => (s.nations.BUR.overlord = 'HAB'))).toBeUndefined();
    expect(
      run(s => {
        forceWar(s, 'FRA', 'BUR');
        s.truces = {};
        declareWar(s, 'BUR', 'FRA', 'none');
      }),
    ).toBeUndefined();
  });

  test('a new one replaces the old', () => {
    const { s, w } = warFraBur();
    makePeace(s, w, deal({ reparations: true }));
    s.truces = {};
    const w2 = declareWar(s, 'ENG', 'BUR', 'none')!;
    makePeace(s, w2, deal({ winner: 'ENG', reparations: true }));
    expect(s.nations.BUR.reparations?.to).toBe('ENG');
    expect(reparationsOf(s, 'BUR')?.to).toBe('ENG');
    expect(ledger(s, 'FRA').income.some(l => l.label.startsWith('Reparations'))).toBe(false);
  });

  test('the AI asks them of a loser with an income, and no extras in a limited war', () => {
    const { s, w } = warFraBur();
    s.nations.BUR.gold = 0;
    s.nations.FRA.rivals = [];
    const t = buildDemands(s, w, 'FRA', reparationsCost(s, 'BUR'));
    expect(t.reparations).toBe(true);
    // A limited war won by its attackers takes its region and gold, nothing more.
    w.limited = true;
    w.goal = 'burgundy';
    s.nations.FRA.rivals = ['BUR'];
    const lim = buildDemands(s, w, 'FRA', 60);
    expect(lim.reparations).toBeFalsy();
    expect(lim.humble).toBeFalsy();
  });
});

describe('the extras never keep a war going', () => {
  test('refused with them but accepted without: signed without', () => {
    const { s, w } = warFraBur();
    // Some of Burgundy held by France, for leverage.
    for (const r of Object.values(s.regions).filter(r => r.owner === 'BUR').slice(0, 2)) r.controller = 'FRA';
    s.nations.BUR.warExhaustion = 0;
    const sc = peaceAcceptance(s, w, deal(), 'BUR').reasons.find(r => r.label === 'Leverage')!.value;
    expect(sc).toBeGreaterThan(0);
    const plain = deal({ gold: sc * 10 });
    expect(peaceAcceptance(s, w, plain, 'BUR').accept).toBe(true);
    const full = { ...plain, humble: true };
    expect(peaceAcceptance(s, w, full, 'BUR').accept).toBe(false);
    const signed = acceptedTerms(s, w, full, 'BUR')!;
    expect(signed.humble).toBeUndefined();
    expect(signed.gold).toBe(sc * 10);
    expect(acceptedTerms(s, w, deal({ gold: sc * 10 + 500 }), 'BUR')).toBeNull();
  });

  test('an ultimatum carries land and gold only', () => {
    const { s, w } = warFraBur();
    const t = fitTerms(s, w, deal({ gold: 50, humble: true, reparations: true }), 100);
    expect(t.humble).toBeUndefined();
    expect(t.reparations).toBeUndefined();
  });
});

test('a save keeps reparations and the day a siege was stormed', () => {
  const { s, reg } = siegeAt(2, 8, 0, 0.5);
  reg.siege!.stormed = s.day - 3;
  s.nations.BUR.reparations = { to: 'FRA', until: s.day + 100 };
  const back = migrateSave(JSON.parse(JSON.stringify(s)) as GameState)!;
  expect(back.regions.burgundy.siege?.stormed).toBe(s.day - 3);
  expect(back.nations.BUR.reparations).toEqual({ to: 'FRA', until: s.day + 100 });
});
