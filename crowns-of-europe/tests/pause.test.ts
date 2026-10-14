import { army, emptyGame, forceWar } from './helpers';
import { DEFAULT_AUTOPAUSE, PAUSE_SETTINGS_VERSION, SAVE_VERSION, migrateSave, migrateSettings, newGame } from '../src/sim/state';
import { drainPauses, offerPause, requestPause } from '../src/sim/log';
import { advanceDay, advanceDays, offerLapses, OFFER_DAYS } from '../src/sim/tick';
import { declareWar, withdrawEnemyOffers } from '../src/sim/war';
import { answerOffer } from '../src/sim/commands';
import { liveUnseenReports } from '../src/sim/queries';
import { debugAI } from '../src/sim/ai';
import { dateOf } from '../src/sim/util';
import type { BattleReport, GameSettings, GameState, PauseReason } from '../src/sim/types';

/** A game with the pause settings a new player starts with (the test helper switches them all on). */
function defaults(player = 'POR'): GameState {
  const s = emptyGame(player);
  s.settings.autoPause = { ...DEFAULT_AUTOPAUSE };
  drainPauses();
  return s;
}

/** Portugal at war with Castile, which holds all of Portugal: Castile's leverage is 80 plus `battles`. */
function beaten(battles: number): GameState {
  const s = defaults('POR');
  s.alliances = {};
  forceWar(s, 'CAS', 'POR');
  const w = declareWar(s, 'CAS', 'POR', 'none')!;
  w.battleScore = battles;
  for (const r of ['lisbon', 'porto', 'alentejo', 'azores', 'madeira']) s.regions[r].controller = 'CAS';
  drainPauses();
  return s;
}

describe('what stops the clock', () => {
  test('a new game pauses for events, a war on you, an ally attacked, an ultimatum and the end; the rest is a notice', () => {
    const on = (Object.keys(DEFAULT_AUTOPAUSE) as PauseReason[]).filter(k => DEFAULT_AUTOPAUSE[k]).sort();
    expect(on).toEqual(['allyAttacked', 'event', 'gameOver', 'ultimatum', 'warDeclaredOnYou']);
    const s = newGame({ player: 'FRA', seed: 1 });
    expect(s.settings.autoPause).toEqual(DEFAULT_AUTOPAUSE);
    expect(s.settings.pauseVersion).toBe(PAUSE_SETTINGS_VERSION);
  });

  test('requestPause asks only for what the settings say', () => {
    const s = defaults();
    drainPauses();
    for (const r of ['peaceOffer', 'offer', 'battleStarted', 'siegeWon', 'armyArrived'] as PauseReason[]) requestPause(s, r);
    expect(drainPauses()).toEqual([]);
    requestPause(s, 'ultimatum');
    requestPause(s, 'event');
    requestPause(s, 'event');
    expect(drainPauses()).toEqual(['ultimatum', 'event']);
    s.settings.autoPause.peaceOffer = true;
    requestPause(s, 'peaceOffer');
    expect(drainPauses()).toEqual(['peaceOffer']);
  });

  test('each offer answers to its own setting', () => {
    const s = defaults('FRA');
    s.wars.w1 = { id: 'w1', name: 'Test War', attackers: ['ENG'], defenders: ['SCO'], cb: 'none', started: s.day, battleScore: 0, goalScore: 0 };
    const terms = { regions: [], gold: 0, vassalize: false, release: [], winner: 'ENG', loser: 'FRA' };
    expect(offerPause(s, { id: 'a', kind: 'peace', from: 'ENG', war: 'w1', day: 0, terms })).toBe('peaceOffer');
    expect(offerPause(s, { id: 'b', kind: 'peace', from: 'ENG', war: 'w1', day: 0, terms, ultimatum: 100 })).toBe('ultimatum');
    // A call from the side that was attacked is the ally under attack; one from the attacker is any other proposal.
    expect(offerPause(s, { id: 'c', kind: 'callToArms', from: 'SCO', war: 'w1', day: 0 })).toBe('allyAttacked');
    expect(offerPause(s, { id: 'd', kind: 'callToArms', from: 'ENG', war: 'w1', day: 0 })).toBe('offer');
    for (const kind of ['alliance', 'marriage', 'access'] as const) expect(offerPause(s, { id: kind, kind, from: 'SCO', day: 0 })).toBe('offer');
  });

  test('a peace proposal is only announced; an ultimatum stops the clock', () => {
    const s = beaten(10);
    debugAI.aiPeace(s, s.nations.CAS);
    expect(s.offers.map(o => o.kind)).toEqual(['peace']);
    expect(drainPauses()).toEqual([]);
    // Switched back on, a proposal pauses as it used to.
    const t = beaten(10);
    t.settings.autoPause.peaceOffer = true;
    debugAI.aiPeace(t, t.nations.CAS);
    expect(drainPauses()).toEqual(['peaceOffer']);
    // At 99% leverage: an ultimatum, which pauses by default.
    const u = beaten(25);
    debugAI.aiPeace(u, u.nations.CAS);
    expect(u.offers).toHaveLength(1);
    expect(offerPause(u, u.offers[0])).toBe('ultimatum');
    expect(drainPauses()).toEqual(['ultimatum']);
  });

  test('a war declared on you still pauses', () => {
    const s = defaults('POR');
    s.alliances = {};
    forceWar(s, 'CAS', 'POR');
    declareWar(s, 'CAS', 'POR', 'none');
    expect(drainPauses()).toContain('warDeclaredOnYou');
  });

  test('waiting offers never hold up time; they lapse on the day the player is told', () => {
    const s = defaults('FRA');
    s.offers.push({ id: 'o1', kind: 'alliance', from: 'SCO', day: s.day });
    let paused = false;
    const lapses = offerLapses(s.offers[0]);
    expect(dateOf(lapses).day).toBe(1);
    expect(lapses - s.day).toBeGreaterThan(OFFER_DAYS);
    while (s.day < lapses - 1) paused ||= advanceDay(s).pause.length > 0;
    expect(paused).toBe(false);
    expect(s.offers).toHaveLength(1);
    advanceDays(s, 1);
    expect(s.offers).toHaveLength(0);
  });
});

describe('pause settings in old saves', () => {
  /** Settings as a save from before this change has them: no ultimatum, offers pausing, a battle toggle switched on. */
  const old = (): GameSettings => {
    const autoPause = { ...DEFAULT_AUTOPAUSE, peaceOffer: true, offer: true, battleStarted: true } as Partial<GameSettings['autoPause']>;
    delete autoPause.ultimatum;
    delete autoPause.allyAttacked;
    return { difficulty: 'normal', ironman: false, tutorial: false, autoPause: autoPause as GameSettings['autoPause'] };
  };

  test('offers stop pausing once; the ultimatum takes its default; the player’s other choices stay', () => {
    const set = migrateSettings(old());
    expect(set.autoPause.peaceOffer).toBe(false);
    expect(set.autoPause.offer).toBe(false);
    expect(set.autoPause.ultimatum).toBe(true);
    expect(set.autoPause.allyAttacked).toBe(true);
    expect(set.autoPause.battleStarted).toBe(true);
    expect(set.autoPause.event).toBe(true);
    expect(set.pauseVersion).toBe(PAUSE_SETTINGS_VERSION);
    // Switched back on afterwards, they stay on through later loads.
    set.autoPause.peaceOffer = true;
    expect(migrateSettings(set).autoPause.peaceOffer).toBe(true);
  });

  test('loading a save migrates its settings, and a new game’s are left alone', () => {
    const s = emptyGame('FRA');
    s.settings = old();
    const m = migrateSave(JSON.parse(JSON.stringify(s)))!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.settings.autoPause.peaceOffer).toBe(false);
    expect(m.settings.autoPause.ultimatum).toBe(true);
    expect(m.settings.autoPause.battleStarted).toBe(true);
    const fresh = newGame({ player: 'FRA', seed: 2 });
    fresh.settings.autoPause.offer = true;
    expect(migrateSave(JSON.parse(JSON.stringify(fresh)))!.settings.autoPause.offer).toBe(true);
  });
});

/** France allied with Scotland only, at peace with England and Scotland. */
function scotsAlly(): GameState {
  const s = defaults('FRA');
  s.alliances = { 'FRA|SCO': s.day };
  for (const [a, b] of [['ENG', 'SCO'], ['ENG', 'FRA'], ['FRA', 'SCO']]) delete s.truces[[a, b].sort().join('|')];
  for (const w of Object.values(s.wars)) if ([...w.attackers, ...w.defenders].some(n => ['FRA', 'ENG', 'SCO'].includes(n))) delete s.wars[w.id];
  drainPauses();
  return s;
}

describe('an ally under attack', () => {
  test('its call to arms stops the clock by default; a call to join an attack is only announced', () => {
    const s = scotsAlly();
    const w = declareWar(s, 'ENG', 'SCO', 'none')!;
    expect(w).toBeTruthy();
    const call = s.offers.find(o => o.kind === 'callToArms')!;
    expect(call.from).toBe('SCO');
    expect(offerPause(s, call)).toBe('allyAttacked');
    expect(drainPauses()).toEqual(['allyAttacked']);
    // Switched off, it drops in as a notice like any other offer.
    const t = scotsAlly();
    t.settings.autoPause.allyAttacked = false;
    declareWar(t, 'ENG', 'SCO', 'none');
    expect(drainPauses()).toEqual([]);
    // Scotland attacking England asks France to join an attack: a notice by default.
    const u = scotsAlly();
    declareWar(u, 'SCO', 'ENG', 'none');
    expect(u.offers.find(o => o.kind === 'callToArms')?.from).toBe('SCO');
    expect(drainPauses()).toEqual([]);
  });

  test('a call left unanswered lapses as a refusal: the alliance breaks', () => {
    const s = scotsAlly();
    declareWar(s, 'ENG', 'SCO', 'none');
    const call = s.offers.find(o => o.kind === 'callToArms')!;
    const renown = s.nations.FRA.prestige;
    while (s.day < offerLapses(call) && s.offers.includes(call)) advanceDay(s);
    expect(s.offers).not.toContain(call);
    expect(s.alliances['FRA|SCO']).toBeUndefined();
    expect(s.nations.FRA.prestige).toBeLessThan(renown);
  });
});

describe('offers that go stale while they wait', () => {
  test('war between them withdraws an alliance, a match or passage, but not a peace offer', () => {
    const s = defaults('FRA');
    s.alliances = {};
    forceWar(s, 'FRA', 'BRI');
    for (const kind of ['alliance', 'marriage', 'access'] as const) s.offers.push({ id: `o-${kind}`, kind, from: 'BRI', day: s.day });
    s.offers.push({ id: 'o-other', kind: 'alliance', from: 'SCO', day: s.day });
    const w = declareWar(s, 'FRA', 'BRI', 'none')!;
    expect(w).toBeTruthy();
    expect(s.offers.map(o => o.id)).toEqual(['o-other']);
    const terms = { regions: [], gold: 0, vassalize: false, release: [], white: true, winner: 'BRI', loser: 'FRA' };
    s.offers.push({ id: 'o-peace', kind: 'peace', from: 'BRI', war: w.id, day: s.day, terms });
    withdrawEnemyOffers(s, w);
    expect(s.offers.map(o => o.id)).toEqual(['o-other', 'o-peace']);
  });

  test('a crown drawn into a war on you (a subject following its overlord) withdraws its offers too', () => {
    const s = defaults('FRA');
    s.alliances = {};
    forceWar(s, 'FRA', 'BUR');
    s.nations.BRI.overlord = 'BUR';
    s.offers.push({ id: 'o1', kind: 'marriage', from: 'BRI', day: s.day });
    const w = declareWar(s, 'FRA', 'BUR', 'none')!;
    expect(w.defenders).toContain('BRI');
    expect(s.offers).toHaveLength(0);
  });

  test('answering an offer from a crown now at war with you refuses it, and it is gone', () => {
    const s = defaults('FRA');
    s.alliances = {};
    forceWar(s, 'FRA', 'BRI');
    declareWar(s, 'FRA', 'BRI', 'none');
    s.offers.push({ id: 'o1', kind: 'alliance', from: 'BRI', day: s.day });
    const r = answerOffer(s, 'o1', true);
    expect(r.ok).toBe(false);
    expect(r.msg).toMatch(/at war/);
    expect(s.alliances['BRI|FRA']).toBeUndefined();
    expect(s.offers).toHaveLength(0);
  });

  test('joining a war withdraws the new enemy’s offers', () => {
    const s = scotsAlly();
    s.offers.push({ id: 'o-eng', kind: 'alliance', from: 'ENG', day: s.day });
    declareWar(s, 'ENG', 'SCO', 'none');
    const call = s.offers.find(o => o.kind === 'callToArms')!;
    expect(s.offers.map(o => o.id)).toContain('o-eng');
    expect(answerOffer(s, call.id, true).ok).toBe(true);
    expect(s.offers.map(o => o.id)).not.toContain('o-eng');
  });
});

describe('unread battle reports', () => {
  const fake = (id: string): BattleReport => ({
    id, day: 0, node: 'champagne', winner: 0, leaders: ['FRA', 'BUR'], nations: [['FRA'], ['BUR']], startMen: [1000, 1000],
    losses: [0, 0], wiped: false, days: 1, generals: ['', ''], warScore: 0, playerSide: 0,
  });

  test('a report that drops out of the list is no longer waiting to be read', () => {
    const s = emptyGame('FRA');
    s.reports = Array.from({ length: 25 }, (_, i) => fake(`old${i}`));
    s.unseenReports = ['old24', 'old3'];
    forceWar(s, 'FRA', 'BUR');
    declareWar(s, 'FRA', 'BUR', 'none');
    const big = army(s, 'FRA', 'champagne', 30, 10);
    army(s, 'BUR', 'burgundy', 6, 2);
    advanceDay(s);
    big.path = ['burgundy'];
    for (let i = 0; i < 60 && s.reports[0].id.startsWith('old'); i++) advanceDay(s);
    const fresh = s.reports[0];
    expect(fresh.id.startsWith('old')).toBe(false);
    expect(s.reports).toHaveLength(25);
    expect(s.unseenReports).toEqual(['old3', fresh.id]);
  });

  test('old saves forget unread reports that can no longer be opened', () => {
    const s = emptyGame('FRA');
    s.reports = [fake('r2'), fake('r1')];
    s.unseenReports = ['r0', 'r1', 'gone'];
    expect(liveUnseenReports(s)).toEqual(['r1']);
    expect(migrateSave(JSON.parse(JSON.stringify(s)))!.unseenReports).toEqual(['r1']);
  });
});
