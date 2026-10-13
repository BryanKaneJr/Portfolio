import { emptyGame, forceWar } from './helpers';
import { DEFAULT_AUTOPAUSE, PAUSE_SETTINGS_VERSION, SAVE_VERSION, migrateSave, migrateSettings, newGame } from '../src/sim/state';
import { drainPauses, offerPause, requestPause } from '../src/sim/log';
import { advanceDay, advanceDays, offerLapses, OFFER_DAYS } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';
import { debugAI } from '../src/sim/ai';
import { dateOf } from '../src/sim/util';
import type { GameSettings, GameState, PauseReason } from '../src/sim/types';

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
  test('a new game pauses for events, a war on you, an ultimatum and the end; everything else is a notice', () => {
    const on = (Object.keys(DEFAULT_AUTOPAUSE) as PauseReason[]).filter(k => DEFAULT_AUTOPAUSE[k]).sort();
    expect(on).toEqual(['event', 'gameOver', 'ultimatum', 'warDeclaredOnYou']);
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
    expect(offerPause({ kind: 'peace' })).toBe('peaceOffer');
    expect(offerPause({ kind: 'peace', ultimatum: 100 })).toBe('ultimatum');
    for (const kind of ['callToArms', 'alliance', 'marriage', 'access'] as const) expect(offerPause({ kind })).toBe('offer');
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
    expect(offerPause(u.offers[0])).toBe('ultimatum');
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
    return { difficulty: 'normal', ironman: false, tutorial: false, autoPause: autoPause as GameSettings['autoPause'] };
  };

  test('offers stop pausing once; the ultimatum takes its default; the player’s other choices stay', () => {
    const set = migrateSettings(old());
    expect(set.autoPause.peaceOffer).toBe(false);
    expect(set.autoPause.offer).toBe(false);
    expect(set.autoPause.ultimatum).toBe(true);
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
