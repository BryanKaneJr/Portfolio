import { army, emptyGame, forceWar } from './helpers';
import { advanceDay, advanceDays } from '../src/sim/tick';
import { findPath } from '../src/sim/military';
import { findSeaPath } from '../src/sim/navy';
import {
  COLONY_GUARD_UPKEEP,
  COLONY_UPKEEP,
  GROW_SETTLERS,
  MAX_GROWN_DEV,
  RAID_PER_REG,
  SETTLERS_NEEDED,
  attackChance,
  attackLines,
  canColonize,
  canGrow,
  colonistSources,
  colonistsOf,
  colonySites,
  discoverNewWorld,
  expectedFoundingDev,
  exportValue,
  freeColonists,
  growingOf,
  monthlySettlers,
  sendExpedition,
  settlerGrowth,
  startColony,
} from '../src/sim/colonies';
import { colonize, growColony, setColonyGuard, setColonyPolicy, stopGrowing } from '../src/sim/commands';
import { advanceFor, learnAdvance } from '../src/sim/science';
import { ledger } from '../src/sim/economy';
import { holyWarAllowed } from '../src/sim/war';
import { bumpOwnership, bumpWars, invalidateMods, unitPower } from '../src/sim/queries';
import { joinOrStartBattle } from '../src/sim/battle';
import { COLONY_HOLD_DAYS, CONTROL_DAYS, controlDays, siegeInfo } from '../src/sim/siege';
import { setController, transferRegion } from '../src/sim/territory';
import { debugAI } from '../src/sim/ai';
import { dateOf, dayOf } from '../src/sim/util';
import type { Fleet, GameState, NationId } from '../src/sim/types';
import { newGame } from '../src/sim/state';
import { NATION, REGION } from '../src/sim/content';

function fleet(s: GameState, owner: string, sea: string, transports: number): Fleet {
  const f: Fleet = { id: `f${++s.seq}`, name: 'Test Fleet', owner, sea, ships: { galley: 0, warship: 0, transport: transports }, hull: 1, path: [], progress: 0, edgeDays: 0 };
  s.fleets[f.id] = f;
  return f;
}

/** Run the game to the first of the next month (when colonies grow). */
function nextMonth(s: GameState): void {
  do advanceDay(s);
  while (dateOf(s.day).day !== 1);
}

/** Hand a region to a nation as a founded colony of its own. */
function give(s: GameState, id: string, n: NationId, dev?: number): void {
  const r = s.regions[id];
  r.owner = n;
  r.controller = n;
  r.cores = [n];
  r.natives = 0;
  if (dev !== undefined) r.dev = dev;
  bumpOwnership();
}

function war(s: GameState, attacker: NationId, defender: NationId): void {
  forceWar(s, attacker, defender);
  s.wars.w1 = { id: 'w1', name: 'Test', attackers: [attacker], defenders: [defender], cb: 'none', started: s.day, battleScore: 0, goalScore: 0 };
  bumpWars();
}

/** Portugal in a New World everyone knows, able to cross the ocean, with gold to spend. */
function portugal(): GameState {
  const s = emptyGame('POR');
  discoverNewWorld(s, null);
  learnAdvance(s, 'POR', 'ocean_navigation');
  s.nations.POR.gold = 5000;
  return s;
}

describe('the New World', () => {
  test('is uncharted until someone finds it', () => {
    const s = emptyGame('POR');
    const a = army(s, 'POR', 'lisbon', 4);
    fleet(s, 'POR', 'iberian_atlantic', 4);
    expect(findPath(s, a, 'pernambuco')).toBeNull();
    expect(findSeaPath('iberian_atlantic', 'caribbean', false)).toBeNull();
    expect(canColonize(s, 'POR', 'bahia')).toMatch(/uncharted/);
    discoverNewWorld(s, null);
    expect(findPath(s, a, 'pernambuco')).not.toBeNull();
    expect(findSeaPath('iberian_atlantic', 'caribbean', true)).not.toBeNull();
  });

  test('an expedition finds it and the discoverer gets a colonist', () => {
    const s = emptyGame('POR');
    s.day = dayOf(1475, 0, 1);
    s.nations.POR.gold = 500;
    // Sailing west needs Ocean Navigation.
    expect(sendExpedition(s, 'POR')).toMatch(/Ocean Navigation/);
    learnAdvance(s, 'POR', 'ocean_navigation');
    expect(sendExpedition(s, 'POR')).toBeNull();
    advanceDays(s, 300);
    expect(s.discovery?.by).toBe('POR');
    expect(s.pendingEvents.some(e => e.event === 'new_world')).toBe(true);
    // Ocean Navigation (1) + Navigators trait (1) + first to the New World (1).
    expect(colonistsOf(s, 'POR')).toBe(3);
  });

  test('everyone knows the way by 1500', () => {
    const s = emptyGame('FRA');
    s.day = dayOf(1499, 11, 15);
    advanceDays(s, 30);
    expect(s.discovery).toBeDefined();
    expect(s.discovery?.by).toBeNull();
  });

  test('a colony grows into a region of yours', () => {
    const s = emptyGame('POR');
    s.nations.POR.gold = 500;
    // Cape Verde is off Africa, not in the New World: Portugal can settle it from the start.
    expect(startColony(s, 'POR', 'cape_verde')).toBeNull();
    expect(s.regions.cape_verde.colony?.by).toBe('POR');
    advanceDays(s, 365 * 15);
    expect(s.regions.cape_verde.owner).toBe('POR');
    expect(s.regions.cape_verde.faith).toBe('catholic');
    expect(s.regions.cape_verde.colony).toBeUndefined();
    expect(ledger(s, 'POR').income.some(i => i.label === 'Colonial goods')).toBe(true);
  });

  test('natives can wipe out an unguarded colony, but not a guarded one', () => {
    const s = emptyGame('POR');
    discoverNewWorld(s, 'POR');
    learnAdvance(s, 'POR', 'ocean_navigation');
    s.nations.POR.gold = 5000;
    s.regions.florida.natives = 8;
    s.regions.rio.natives = 8;
    expect(startColony(s, 'POR', 'florida')).toBeNull();
    expect(startColony(s, 'POR', 'rio')).toBeNull();
    army(s, 'POR', 'rio', 3);
    let destroyed = false;
    for (let m = 0; m < 240 && !destroyed; m++) {
      advanceDays(s, 30);
      if (!s.regions.florida.colony && !s.regions.florida.owner) destroyed = true;
      if (destroyed) break;
      s.regions.florida.colony!.settlers = Math.min(s.regions.florida.colony!.settlers, 100);
    }
    expect(destroyed).toBe(true);
    expect(s.regions.rio.colony?.by ?? s.regions.rio.owner).toBe('POR');
  });

  test('one fleet carries an army across the ocean', () => {
    const s = emptyGame('POR');
    discoverNewWorld(s, null);
    const a = army(s, 'POR', 'lisbon', 6);
    const f = fleet(s, 'POR', 'iberian_atlantic', 2);
    const res = findPath(s, a, 'pernambuco');
    expect(res).not.toBeNull();
    const landingSea = res!.path[res!.path.length - 2];
    expect(res!.path.filter(n => n in s.regions).length).toBe(1); // straight across, by sea
    a.path = [...res!.path];
    advanceDays(s, res!.days + 2);
    expect(a.node).toBe('pernambuco');
    expect(f.sea).toBe(landingSea);
  });

  test('native peoples fight with weaker troops and can be the target of holy war', () => {
    const s = emptyGame('CAS');
    expect(holyWarAllowed(s, 'CAS', 'AZT')).toBe(true);
    expect(unitPower(s, 'AZT', 'inf')).toBeLessThan(unitPower(s, 'CAS', 'inf'));
    // A Renaissance army beats a larger Aztec host.
    discoverNewWorld(s, null);
    s.nations.CAS.era = 2;
    const cas = army(s, 'CAS', 'anahuac', 10, 4);
    army(s, 'AZT', 'anahuac', 18);
    s.wars.w1 = { id: 'w1', name: 'Test', attackers: ['CAS'], defenders: ['AZT'], cb: 'holy', started: s.day, battleScore: 0, goalScore: 0 };
    advanceDays(s, 1);
    joinOrStartBattle(s, 'anahuac', cas);
    advanceDays(s, 40);
    const report = s.reports[0];
    expect(report).toBeDefined();
    expect(report.nations[report.winner]).toContain('CAS');
  });

  test('the AI sends colonists and founds colonies on its own', () => {
    const s = newGame({ player: 'FRA', seed: 11 });
    s.flags.__spectate = 1;
    s.day = dayOf(1490, 0, 1);
    // Jumping ahead 46 years: the Atlantic crowns have learned to cross the ocean meanwhile.
    for (const n of ['POR', 'CAS', 'ENG', 'FRA']) learnAdvance(s, n, 'ocean_navigation');
    discoverNewWorld(s, 'POR');
    advanceDays(s, 365 * 14);
    const colonized = Object.values(s.regions).filter(r => r.owner && REGION[r.id].nw && !NATION[r.owner].native);
    expect(colonized.length).toBeGreaterThan(0);
    for (const r of Object.values(s.regions)) if (r.colony) expect(r.owner).toBeNull();
    expect(SETTLERS_NEEDED).toBe(1000);
  }, 60000);
});

describe('colonization', () => {
  test('Ocean Navigation gives every Atlantic Christian crown a colonist; a great realm with Galleons gets a second', () => {
    const s = emptyGame('FRA');
    expect(colonistsOf(s, 'ENG')).toBe(0);
    learnAdvance(s, 'ENG', 'caravels');
    learnAdvance(s, 'ENG', 'ocean_navigation');
    expect(colonistsOf(s, 'ENG')).toBe(1);
    expect(colonistSources(s, 'ENG')[0].label).toContain(advanceFor('oceanColonies').name);
    learnAdvance(s, 'ENG', 'galleons');
    expect(colonistsOf(s, 'ENG')).toBe(2);
    expect(colonistSources(s, 'ENG').map(p => p.label)).toContain('Great realm with an ocean coast and Galleons');
    // A small crown gets only the first; a crown far from the ocean, or not Christian, none.
    for (const n of ['SCO', 'HUN', 'MOR']) {
      learnAdvance(s, n, 'caravels');
      learnAdvance(s, n, 'ocean_navigation');
      learnAdvance(s, n, 'galleons');
    }
    expect(colonistsOf(s, 'SCO')).toBe(1);
    expect(colonistsOf(s, 'HUN')).toBe(0);
    expect(colonistsOf(s, 'MOR')).toBe(0);
  });

  test('a free colonist grows a founded colony: +1 prosperity per 500 settlers, up to 8', () => {
    const s = portugal();
    give(s, 'bahia', 'POR', 5); // natural growth stops at 5, so only settlers raise it here
    give(s, 'pernambuco', 'POR', 7);
    expect(colonistsOf(s, 'POR')).toBe(2); // Ocean Navigation and Navigators
    expect(canGrow(s, 'POR', 'rio')).toMatch(/your own/);
    expect(canGrow(s, 'POR', 'lisbon')).toMatch(/New World/);
    expect(growColony(s, 'bahia').ok).toBe(true);
    expect(freeColonists(s, 'POR')).toBe(1);
    expect(growingOf(s, 'POR').map(r => r.id)).toEqual(['bahia']);
    expect(canGrow(s, 'POR', 'bahia')).toMatch(/already/);
    const lines = settlerGrowth(s, s.regions.bahia).map(l => l.label);
    expect(lines).toContain('Settlers arriving');
    expect(lines.some(l => l.startsWith('Settlers spread thin'))).toBe(true);
    expect(lines.some(l => l.startsWith('Natives') || l.startsWith('Next to'))).toBe(false);
    expect(ledger(s, 'POR').expenses.find(e => e.label.startsWith('Colonies being grown'))?.value).toBe(COLONY_UPKEEP);

    nextMonth(s);
    expect(s.regions.bahia.growing!.settlers).toBeCloseTo(monthlySettlers(s, s.regions.bahia));
    s.regions.bahia.growing!.settlers = GROW_SETTLERS - 1;
    nextMonth(s);
    expect(s.regions.bahia.dev).toBe(6);
    expect(s.regions.bahia.growing?.settlers).toBe(0);

    // At prosperity 8 the colonist is free again.
    expect(growColony(s, 'pernambuco').ok).toBe(true);
    expect(freeColonists(s, 'POR')).toBe(0);
    expect(canGrow(s, 'POR', 'rio')).toMatch(/your own/);
    s.regions.pernambuco.growing!.settlers = GROW_SETTLERS - 1;
    nextMonth(s);
    expect(s.regions.pernambuco.dev).toBe(MAX_GROWN_DEV);
    expect(s.regions.pernambuco.growing).toBeUndefined();
    expect(freeColonists(s, 'POR')).toBe(1);
    expect(s.log.some(e => e.text.includes('Pernambuco') && e.text.includes('free again'))).toBe(true);
    expect(canGrow(s, 'POR', 'pernambuco')).toMatch(/only to 8/);

    // Lost in a peace (or occupied), the colonist comes home.
    transferRegion(s, 'bahia', 'CAS');
    nextMonth(s);
    expect(s.regions.bahia.growing).toBeUndefined();
    expect(freeColonists(s, 'POR')).toBe(2);
    give(s, 'rio', 'POR', 5);
    expect(growColony(s, 'rio').ok).toBe(true);
    setController(s, 'rio', 'CAS');
    nextMonth(s);
    expect(s.regions.rio.growing).toBeUndefined();
    expect(freeColonists(s, 'POR')).toBe(2);
    // ... or called home.
    setController(s, 'rio', 'POR');
    expect(growColony(s, 'rio').ok).toBe(true);
    expect(stopGrowing(s, 'rio').ok).toBe(true);
    expect(stopGrowing(s, 'rio').ok).toBe(false);
    expect(freeColonists(s, 'POR')).toBe(2);
  });

  test('a guarded colony is never attacked by the natives, and its guards cost extra upkeep', () => {
    const s = portugal();
    s.regions.florida.natives = 8; // fierce: 6% a month
    expect(colonize(s, 'florida').ok).toBe(true);
    expect(attackChance(s, s.regions.florida)).toBeCloseTo(0.06);
    const before = ledger(s, 'POR').totalExpenses;
    expect(setColonyGuard(s, 'florida', true).ok).toBe(true);
    expect(setColonyGuard(s, 'florida', true).ok).toBe(false);
    expect(attackChance(s, s.regions.florida)).toBe(0);
    expect(attackLines(s, s.regions.florida).map(l => l.label)).toContain('Guards on the colony');
    const l = ledger(s, 'POR');
    expect(l.expenses.find(e => e.label.startsWith('Guards for colonies'))?.value).toBe(COLONY_GUARD_UPKEEP);
    expect(l.totalExpenses).toBeCloseTo(before + COLONY_GUARD_UPKEEP);
    for (let m = 0; m < 120; m++) {
      const c = s.regions.florida.colony!;
      c.settlers = Math.min(c.settlers, 500);
      const was = c.settlers;
      nextMonth(s);
      expect(s.regions.florida.colony!.settlers).toBeGreaterThan(was);
    }
    expect(s.log.some(e => e.text.startsWith('Natives attack'))).toBe(false);
    // Guards push the natives back, as troops do.
    expect(s.regions.florida.natives).toBeLessThan(8 - 120 * 0.02);
    expect(setColonyGuard(s, 'florida', false).ok).toBe(true);
    expect(ledger(s, 'POR').expenses.some(e => e.label.startsWith('Guards'))).toBe(false);
  });

  test('trading with the natives: slower settlers, no attacks unless they are fierce, and they join the colony', () => {
    const s = portugal();
    s.nations.POR.modifiers.push({ id: 'test', name: 'Test', mods: { colonists: 4 }, until: -1 });
    invalidateMods();
    expect(colonize(s, 'hispaniola', 'trade').ok).toBe(true); // 5k wary natives
    expect(colonize(s, 'cuba', 'force').ok).toBe(true); // 3k wary natives
    expect(colonize(s, 'chesapeake', 'trade').ok).toBe(true); // 3k hostile natives
    expect(colonize(s, 'antilles', 'trade').ok).toBe(true); // 2k fierce natives
    expect(colonize(s, 'cape_verde', 'trade').ok).toBe(true); // nobody lives there: nothing to trade
    expect(s.regions.cape_verde.colony!.policy).toBe('force');
    expect(s.regions.hispaniola.colony!.natives0).toBe(5);

    // Growth: a flat 15% for trading, instead of 7% per thousand natives.
    const trade = settlerGrowth(s, s.regions.hispaniola);
    const line = trade.find(l => l.label === 'Trading with the natives')!;
    expect(line).toBeDefined();
    expect(trade.some(l => l.label.startsWith('Natives ('))).toBe(false);
    const before = trade.slice(0, trade.indexOf(line)).reduce((t, l) => t + l.value, 0);
    expect(-line.value).toBeCloseTo(before * 0.15, 0);
    expect(settlerGrowth(s, s.regions.cuba).some(l => l.label === 'Natives (3k)')).toBe(true);

    // Attacks: none from hostile natives one trades with, half as many from fierce ones.
    expect(attackChance(s, s.regions.chesapeake)).toBe(0);
    expect(attackChance(s, s.regions.antilles)).toBeCloseTo((2 * 3 * 0.0025) / 2);
    expect(attackLines(s, s.regions.antilles).map(l => l.label)).toContain('Trading with the natives (fierce: half)');

    // Founding: trading partners join (+1 prosperity per 2,000 at the start, no unrest); those whose land was
    // taken add 1 per 3,000 and resent it.
    setColonyGuard(s, 'cuba', true);
    s.regions.hispaniola.colony!.settlers = SETTLERS_NEEDED - 1;
    s.regions.cuba.colony!.settlers = SETTLERS_NEEDED - 1;
    nextMonth(s);
    expect(s.regions.hispaniola.owner).toBe('POR');
    expect(s.regions.hispaniola.dev).toBe(REGION.hispaniola.dev + 2);
    expect(s.regions.hispaniola.unrestMods).toHaveLength(0);
    expect(s.regions.cuba.owner).toBe('POR');
    expect(s.regions.cuba.dev).toBe(REGION.cuba.dev); // 2.98k natives left: no bonus
    expect(s.regions.cuba.unrestMods.some(m => m.amount === 2)).toBe(true);

    // A trading colony may turn to force, never back.
    expect(setColonyPolicy(s, 'chesapeake', 'force').ok).toBe(true);
    expect(s.regions.chesapeake.colony!.policy).toBe('force');
    expect(attackChance(s, s.regions.chesapeake)).toBeGreaterThan(0);
    expect(setColonyPolicy(s, 'chesapeake', 'trade').ok).toBe(false);
  });

  test('colonySites lists where to settle: settleable first, then the most worth having', () => {
    const s = portugal();
    expect(startColony(s, 'POR', 'bahia')).toBeNull();
    give(s, 'pernambuco', 'CAS');
    const sites = colonySites(s, 'POR');
    const ids = sites.map(x => x.id);
    expect(ids).toEqual(expect.arrayContaining(['cape_verde', 'florida', 'guinea', 'minas']));
    expect(ids).not.toContain('bahia'); // being settled
    expect(ids).not.toContain('pernambuco'); // taken
    const firstBlocked = sites.findIndex(x => x.blocked);
    expect(firstBlocked).toBeGreaterThan(0);
    expect(sites.slice(firstBlocked).every(x => x.blocked)).toBe(true);
    expect(sites.find(x => x.id === 'minas')!.blocked).toMatch(/Inland/);
    const worth = (x: (typeof sites)[0]) => (x.value + 0.1) / (Math.min(x.years.force, x.years.trade) + 5);
    const open = sites.slice(0, firstBlocked);
    for (let i = 1; i < open.length; i++) expect(worth(open[i - 1])).toBeGreaterThanOrEqual(worth(open[i]));

    const fl = sites.find(x => x.id === 'florida')!;
    expect(fl.risk).toBeCloseTo(3 * 3 * 0.0025);
    expect(fl.perMonth.trade).toBeGreaterThan(fl.perMonth.force); // 3k natives cost 21% by force, 15% trading
    expect(fl.years.force).toBeCloseTo(SETTLERS_NEEDED / fl.perMonth.force / 12, 1);
    expect(fl.good).toBe('fish');
    expect(fl.dev).toBe(REGION.florida.dev + 1);
    expect(fl.value).toBeCloseTo(exportValue(s, 'POR', 'fish', fl.dev));
    // The projection is what the colony really gets once started.
    expect(startColony(s, 'POR', 'florida', 'trade')).toBeNull();
    expect(monthlySettlers(s, s.regions.florida)).toBeCloseTo(fl.perMonth.trade);
    // No free colonist: everything is blocked.
    expect(colonySites(s, 'POR').every(x => x.blocked === 'All your colonists are busy.')).toBe(true);
  });

  test('enemy armies raid colonies being settled and can wipe them out, unless a defender stands there', () => {
    const s = portugal();
    s.regions.bahia.natives = 0;
    s.regions.pernambuco.natives = 0;
    expect(startColony(s, 'POR', 'bahia')).toBeNull();
    expect(startColony(s, 'POR', 'pernambuco')).toBeNull();
    s.regions.bahia.colony!.settlers = 500;
    s.regions.pernambuco.colony!.settlers = 500;
    war(s, 'CAS', 'POR');
    s.day = dayOf(1444, 0, 31); // the last day of a month
    army(s, 'CAS', 'bahia', 5);
    army(s, 'CAS', 'pernambuco', 5);
    army(s, 'POR', 'pernambuco', 3);
    advanceDay(s);
    expect(dateOf(s.day).day).toBe(1);
    const bahia = s.regions.bahia;
    expect(bahia.colony!.settlers).toBeCloseTo(500 - 5 * RAID_PER_REG + monthlySettlers(s, bahia));
    expect(bahia.lastRaid).toBe(s.day);
    expect(s.log.some(e => e.text.startsWith('Castile raids your settlers in Bahia: 100 killed'))).toBe(true);
    expect(s.regions.pernambuco.colony!.settlers).toBeGreaterThan(500); // defended
    expect(s.regions.pernambuco.lastRaid).toBeUndefined();

    bahia.colony!.settlers = 150;
    army(s, 'CAS', 'bahia', 10);
    nextMonth(s);
    expect(bahia.colony).toBeUndefined();
    expect(bahia.owner).toBeNull();
    expect(s.log.some(e => e.text.includes('The colony is lost'))).toBe(true);
  });

  test('a founded colony holds out 60 days against an enemy army; a native realm or an occupied colony does not', () => {
    const s = portugal();
    give(s, 'bahia', 'POR', 3);
    war(s, 'CAS', 'POR');
    army(s, 'CAS', 'bahia', 6);
    advanceDays(s, 2);
    expect(controlDays(s, 'bahia')).toBe(COLONY_HOLD_DAYS);
    expect(siegeInfo(s, 'bahia')!.daily).toBeCloseTo(1 / COLONY_HOLD_DAYS);
    expect(controlDays(s, 'anahuac')).toBe(CONTROL_DAYS); // the Aztecs' land
    expect(controlDays(s, 'normandy')).toBe(CONTROL_DAYS);
    advanceDays(s, 40);
    expect(s.regions.bahia.controller).toBe('POR');
    expect(s.regions.bahia.siege?.progress).toBeGreaterThan(0.6);
    advanceDays(s, 25);
    expect(s.regions.bahia.controller).toBe('CAS');
    expect(controlDays(s, 'bahia')).toBe(CONTROL_DAYS); // retaking it is quick
  });

  test('the AI grows a colony when it has a free colonist and no land worth settling', () => {
    const s = emptyGame('FRA');
    discoverNewWorld(s, null);
    learnAdvance(s, 'POR', 'ocean_navigation');
    give(s, 'bahia', 'POR', 3);
    give(s, 'new_granada', 'POR', 3);
    for (const r of Object.values(s.regions)) if (!r.owner) r.colony = { by: 'ENG', settlers: 0, started: s.day };
    const por = s.nations.POR;
    por.gold = 1000;
    por.lastMonthIncome = 50;
    por.lastMonthExpenses = 10;
    expect(freeColonists(s, 'POR')).toBe(2);
    debugAI.aiColonies(s, por);
    expect(s.regions.new_granada.growing?.by).toBe('POR'); // gold pays more than sugar
    debugAI.aiColonies(s, por);
    expect(s.regions.bahia.growing?.by).toBe('POR');
    expect(freeColonists(s, 'POR')).toBe(0);
  });

  test('the AI trades with hostile natives, takes the land of fierce ones, and guards colonies at risk', () => {
    const s = emptyGame('FRA');
    discoverNewWorld(s, null);
    learnAdvance(s, 'POR', 'ocean_navigation');
    const keep = ['chesapeake', 'florida'];
    for (const r of Object.values(s.regions)) if (!r.owner && !keep.includes(r.id)) r.colony = { by: 'ENG', settlers: 0, started: s.day };
    const por = s.nations.POR;
    por.gold = 1000;
    por.lastMonthIncome = 50;
    por.lastMonthExpenses = 10;
    debugAI.aiColonies(s, por);
    debugAI.aiColonies(s, por);
    expect(s.regions.chesapeake.colony?.policy).toBe('trade'); // 3k hostile natives
    expect(s.regions.florida.colony?.policy).toBe('force'); // 3k fierce natives
    debugAI.aiColonies(s, por);
    expect(s.regions.florida.colony?.guard).toBe(true);
    expect(s.regions.chesapeake.colony?.guard).toBeUndefined(); // in no danger
  });

  test('at war, the AI raises troops in a safe colony when an enemy army threatens its New World land', () => {
    const s = emptyGame('FRA');
    discoverNewWorld(s, null);
    give(s, 'bahia', 'POR', 3);
    give(s, 'rio', 'POR', 3);
    war(s, 'CAS', 'POR');
    advanceDays(s, 1);
    army(s, 'CAS', 'bahia', 4);
    const por = s.nations.POR;
    por.gold = 1000;
    por.manpower = 10000;
    debugAI.aiColonies(s, por);
    expect(por.recruiting.length).toBeGreaterThanOrEqual(1);
    expect(por.recruiting.length).toBeLessThanOrEqual(2);
    expect(por.recruiting.every(r => r.region === 'rio')).toBe(true);
    // Rarely: not again for a while.
    const n = por.recruiting.length;
    debugAI.aiColonies(s, por);
    expect(por.recruiting.length).toBe(n);
  });

  test('old saves: colonies without a policy or guards settle as before (by force)', () => {
    const fresh = portugal();
    fresh.regions.chesapeake.colony = { by: 'POR', settlers: SETTLERS_NEEDED - 1, started: fresh.day }; // the old shape
    fresh.regions.chesapeake.natives = 6;
    const s: GameState = JSON.parse(JSON.stringify(fresh));
    const r = s.regions.chesapeake;
    expect(settlerGrowth(s, r).some(l => l.label === 'Natives (6k)')).toBe(true);
    expect(attackChance(s, r)).toBeCloseTo(6 * 2 * 0.0025);
    expect(ledger(s, 'POR').expenses.find(e => e.label === 'Colonies being settled (1)')?.value).toBe(COLONY_UPKEEP);
    expect(ledger(s, 'POR').expenses.some(e => e.label.startsWith('Guards'))).toBe(false);
    army(s, 'POR', 'chesapeake', 2); // so no attack spoils the founding
    nextMonth(s);
    expect(r.owner).toBe('POR');
    expect(r.dev).toBe(REGION.chesapeake.dev + 1); // 5.5-5.98k natives join: +1
    expect(r.unrestMods.some(m => m.amount === 2)).toBe(true);
    expect(r.faith).toBe('native'); // too many to give up their faith
  });

  test('colonists lost (a timed charter ending) call back the newest colony being grown', () => {
    const s = portugal();
    give(s, 'bahia', 'POR', 3);
    give(s, 'pernambuco', 'POR', 3);
    give(s, 'rio', 'POR', 3);
    s.nations.POR.modifiers.push({ id: 'charter', name: 'Charter', mods: { colonists: 1 }, until: s.day + 40 });
    invalidateMods();
    expect(colonistsOf(s, 'POR')).toBe(3);
    expect(growColony(s, 'bahia').ok).toBe(true);
    s.day += 1;
    expect(growColony(s, 'pernambuco').ok).toBe(true);
    s.day += 1;
    expect(growColony(s, 'rio').ok).toBe(true);
    advanceDays(s, 70); // the charter runs out; a month turns
    expect(colonistsOf(s, 'POR')).toBe(2);
    expect(freeColonists(s, 'POR')).toBe(0);
    expect(growingOf(s, 'POR').map(r => r.id).sort()).toEqual(['bahia', 'pernambuco']);
  });

  test('a new colony is not marked as raided for a raid on an earlier one there', () => {
    const s = portugal();
    s.regions.bahia.natives = 0;
    s.regions.bahia.lastRaid = s.day - 5;
    expect(startColony(s, 'POR', 'bahia')).toBeNull();
    expect(s.regions.bahia.lastRaid).toBeUndefined();
  });

  test('the prosperity a colony taking the land will have counts the natives it pushes back by then', () => {
    const s = portugal();
    const r = s.regions.bahia;
    r.natives = 3;
    expect(expectedFoundingDev(s, 'POR', 'bahia', 'trade')).toBe(REGION.bahia.dev + 1); // 3k join, as they are
    expect(expectedFoundingDev(s, 'POR', 'bahia', 'force')).toBe(REGION.bahia.dev); // fewer than 3k left by then
    const site = colonySites(s, 'POR').find(x => x.id === 'bahia')!;
    expect(site.dev).toBe(expectedFoundingDev(s, 'POR', 'bahia', site.best));
  });

  test('at war, an AI army raids an undefended enemy colony being settled nearby', () => {
    const s = emptyGame('FRA');
    discoverNewWorld(s, null);
    give(s, 'pernambuco', 'CAS', 3);
    s.regions.bahia.natives = 0;
    s.regions.bahia.colony = { by: 'POR', settlers: 400, started: s.day };
    war(s, 'CAS', 'POR');
    const cas = army(s, 'CAS', 'pernambuco', 6);
    debugAI.armyAI(s, cas);
    expect(cas.path[cas.path.length - 1]).toBe('bahia');
  });

  test('an army of a realm both allied with and at war with a region owner takes the region', () => {
    const s = emptyGame('POR');
    forceWar(s, 'FRA', 'SCO');
    s.alliances['FRA|SCO'] = s.day;
    war(s, 'FRA', 'SCO');
    s.regions.highlands.fort = 0;
    army(s, 'FRA', 'highlands', 6);
    advanceDays(s, 30);
    expect(s.regions.highlands.controller).toBe('FRA');
    expect(s.regions.highlands.siege).toBeUndefined();
  });

  test('at peace, troops stranded across the ocean keep a garrison and disband the rest', () => {
    const s = emptyGame('FRA');
    discoverNewWorld(s, null);
    give(s, 'quebec', 'FRA', 3);
    give(s, 'acadia', 'FRA', 3);
    const a = army(s, 'FRA', 'quebec', 20);
    const levies = s.nations.FRA.manpower;
    debugAI.armyAI(s, a);
    const left = Object.values(s.armies).filter(x => x.owner === 'FRA' && REGION[x.node]?.nw).reduce((t, x) => t + x.regs.inf.n, 0);
    expect(left).toBe(2);
    expect(s.nations.FRA.manpower).toBeGreaterThan(levies);
  });
});

