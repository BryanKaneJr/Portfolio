/** The fun package: moments (cards and banners), next goals, the quiet-years speed, odds before an attack, a battle's why. */
import { makeArmy, newGame } from '../src/sim/state';
import { advanceDay, advanceDays } from '../src/sim/tick';
import { declareWar, makePeace } from '../src/sim/war';
import { moment } from '../src/sim/log';
import { nextGoals } from '../src/sim/goals';
import { attackOdds } from '../src/sim/forecast';
import { allowedSpeed, FAST } from '../src/state/speed';
import { battleWhy } from '../src/ui/describe';
import { EVENT, GRAPH, REGION } from '../src/sim/content';
import type { GameState, PeaceTerms } from '../src/sim/types';

/** A quiet world with no armies (as tests/helpers.ts emptyGame; copied, not shared). */
function quiet(player: string, seed = 7): GameState {
  const s = newGame({ player, seed });
  s.armies = {};
  s.fleets = {};
  s.flags.__noAI = 1;
  s.flags.__noEvents = 1;
  return s;
}
function army(s: GameState, owner: string, node: string, inf: number, cav = 0) {
  const a = makeArmy(s, owner, node, inf, cav, 0);
  a.morale = 10;
  s.armies[a.id] = a;
  return a;
}
function war(s: GameState, a: string, b: string) {
  delete s.truces[[a, b].sort().join('|')];
  s.alliances = {};
  return declareWar(s, a, b, 'none')!;
}
const terms = (winner: string, loser: string, regions: string[]): PeaceTerms => ({
  regions,
  gold: 0,
  vassalize: false,
  release: [],
  winner,
  loser,
});
const canonical = (x: unknown): string =>
  JSON.stringify(x, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );

describe('moments', () => {
  test("the player's peace is a card with the land gained", () => {
    const s = quiet('CAS');
    const w = war(s, 'CAS', 'GRA');
    makePeace(s, w, { ...terms('CAS', 'GRA', ['granada']), gold: 0 });
    const m = s.moments!.filter(x => x.kind === 'peace');
    expect(m).toHaveLength(1);
    expect(m[0].card).toBe(true);
    expect(m[0].tone).toBe('good');
    expect(m[0].gained).toEqual(['granada']);
    expect(m[0].title).toBe('Granada Is Ours');
    expect(m[0].lines!.some(l => l.startsWith('Truce until'))).toBe(true);
  });

  test("a peace among the computer's realms pushes no moment", () => {
    const s = quiet('FRA');
    const w = war(s, 'CAS', 'GRA');
    makePeace(s, w, terms('CAS', 'GRA', ['granada']));
    expect(s.moments!.filter(x => x.kind === 'peace')).toHaveLength(0);
  });

  test('an enemy crossing into your land is a banner, once a month for each enemy', () => {
    const s = quiet('FRA');
    war(s, 'BUR', 'FRA');
    const from = 'burgundy';
    const into = GRAPH[from].find(e => e.kind === 'land' && s.regions[e.to]?.owner === 'FRA')!.to;
    const a = army(s, 'BUR', from, 6);
    const crossings = () => s.moments!.filter(m => m.kind === 'invaded');
    for (let i = 0; i < 2; i++) {
      a.path = [into];
      for (let d = 0; d < 20 && a.node !== into; d++) advanceDay(s);
      expect(a.node).toBe(into);
      a.path = [from];
      for (let d = 0; d < 20 && a.node !== from; d++) advanceDay(s);
    }
    expect(crossings()).toHaveLength(1);
    expect(crossings()[0]).toMatchObject({ card: false, tone: 'bad', node: into, nation: 'BUR' });
  });

  test('a moment never draws on the random numbers', () => {
    const run = (extra: boolean) => {
      const s = newGame({ player: 'FRA', seed: 21 });
      if (extra)
        for (let i = 0; i < 5; i++) moment(s, { kind: 'headline', card: false, tone: 'info', title: `Test ${i}` });
      advanceDays(s, 200);
      return s;
    };
    const a = run(false);
    const b = run(true);
    expect(b.rng).toEqual(a.rng);
    expect(new Set(b.moments!.map(m => m.id)).size).toBe(b.moments!.length);
    // The same seed replays to the same game, moments and all.
    expect(canonical(run(true))).toBe(canonical(b));
  }, 60000);
});

describe('next goals', () => {
  test('Castile in 1444 is pointed at Granada', () => {
    const s = newGame({ player: 'CAS', seed: 1 });
    const goals = nextGoals(s, 'CAS');
    expect(goals.length).toBeGreaterThan(0);
    expect(goals.length).toBeLessThanOrEqual(3);
    expect(goals.some(g => g.text.includes('Granada'))).toBe(true);
  });
});

describe('speed', () => {
  test('the quiet-years speed is refused at war', () => {
    const s = quiet('FRA');
    expect(allowedSpeed(s, FAST)).toBe(FAST);
    war(s, 'FRA', 'BUR');
    expect(allowedSpeed(s, FAST)).toBe(FAST - 1);
    expect(allowedSpeed(s, 1)).toBe(1);
  });
});

describe('odds before an attack', () => {
  test('5 regiments marching on 20 in the mountains are outmatched', () => {
    const s = quiet('FRA');
    war(s, 'FRA', 'BUR');
    const hill = 'auvergne';
    expect(REGION[hill].terrain).toBe('mountains');
    const from = GRAPH[hill].find(e => e.kind === 'land')!.to;
    const ours = army(s, 'FRA', from, 5);
    army(s, 'BUR', hill, 20);
    ours.path = [hill];
    const o = attackOdds(s, ours.id)!;
    expect(o).toBeTruthy();
    expect(o.node).toBe(hill);
    expect(o.verdict).toBe('outmatched');
    expect(o.reasons.length).toBeGreaterThan(0);
    expect(o.reasons.length).toBeLessThanOrEqual(2);
  });
});

describe("a battle's why", () => {
  test('the report keeps the ground and the opening odds, and says why from the player’s side', () => {
    const s = quiet('FRA');
    war(s, 'FRA', 'BUR');
    const big = army(s, 'FRA', 'champagne', 30, 10);
    army(s, 'BUR', 'burgundy', 6, 2);
    advanceDay(s);
    big.path = ['burgundy'];
    for (let d = 0; d < 60 && !s.reports.length; d++) advanceDay(s);
    const r = s.reports[0];
    expect(r.why).toBeDefined();
    expect(r.why!.regs).toEqual([40, 8]);
    expect(r.why!.terrain).toBe(REGION.burgundy.terrain);
    const lines = battleWhy(r);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.some(l => l.includes('40 regiments'))).toBe(true);
  });
});

// The store, without the device's storage.
jest.mock('../src/state/storage', () => ({
  loadPrefs: () => Promise.resolve({}),
  savePrefs: () => Promise.resolve(),
  saveGame: () => Promise.resolve(),
  recordAchievements: () => Promise.resolve(),
}));

describe('the store shows moments', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('cards of one batch open as one card and pause; banners drop in as notices; cards wait behind an event', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { store } = require('../src/state/store') as typeof import('../src/state/store');
    const s = quiet('CAS');
    store.load(s);
    moment(s, { kind: 'mission', card: true, tone: 'good', title: 'A' });
    moment(s, { kind: 'peace', card: true, tone: 'good', title: 'B' });
    moment(s, { kind: 'headline', card: false, tone: 'info', title: 'C' });
    store.setPaused(false);
    expect(store.notify()).toBe(true);
    expect(store.overlay).toEqual({ kind: 'moment', ids: s.moments!.slice(0, 2).map(m => m.id) });
    expect(store.paused).toBe(true);
    expect(store.toasts.map(t => t.text)).toEqual(['C']);
    // A later card joins the one already up.
    moment(s, { kind: 'achievement', card: true, tone: 'good', title: 'D' });
    store.notify();
    expect(store.overlay?.kind === 'moment' && store.overlay.ids).toHaveLength(3);
    // Closing lets the clock run on, as it was running.
    store.leaveCard();
    expect(store.overlay).toBeNull();
    expect(store.paused).toBe(false);
    store.stop();
    // Behind an event card, a moment card waits its turn.
    s.pendingEvents.push({ event: Object.keys(EVENT)[0], nation: 'CAS', day: s.day });
    moment(s, { kind: 'mission', card: true, tone: 'good', title: 'E' });
    expect(store.notify()).toBe(true); // a card is coming
    expect(store.overlay).toBeNull();
    s.pendingEvents = [];
    expect(store.notify()).toBe(true);
    expect(store.overlay?.kind).toBe('moment');
    store.leaveCard();
    // A peace signed from the war panel: the card waits for the panel to close itself, then comes up.
    store.open({ kind: 'peace', war: 'w1' });
    moment(s, { kind: 'peace', card: true, tone: 'good', title: 'F' });
    expect(store.notify()).toBe(true);
    expect(store.overlay?.kind).toBe('peace');
    store.close();
    expect(store.overlay?.kind).toBe('moment');
    store.unload();
  });
});
