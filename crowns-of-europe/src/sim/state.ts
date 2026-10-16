/** Creates a fresh 1444 campaign from the bundled scenario. */
import { MAP_REGION, NATION, NATIONS, POLICIES, REGIONS, SCENARIO, bindDisplay, regionName } from './content';
import { startingAdvances } from './science';
import { forceLimit, invalidateMods, liveUnseenReports, maxMorale, totalDev } from './queries';
import type { Army, Fleet, GameSettings, GameState, Nation, NationId, PauseReason, Region } from './types';
import { dayOf, randInt, years, pairKey } from './util';
import { newGeneral } from './rulers';
import { maxManpower } from './economy';

/**
 * Version 7 redrew Italy (24 regions and three new crowns). Version 8 added 22 regions (Ireland, England, the North,
 * the Baltic, Russia, the steppe, Anatolia, five more powers): saves from before it cannot be read.
 */
export const SAVE_VERSION = 8;

/** A save made by an older version, which this one cannot load (rather than one that is damaged). */
export const saveTooOld = (s: { version?: unknown }): boolean => typeof s.version === 'number' && s.version < SAVE_VERSION;

/** Brings a save up to date, or returns null if it is from an older version (`saveTooOld` says which). */
export function migrateSave(s: GameState): GameState | null {
  if (s.version !== SAVE_VERSION) return null;
  migrateSettings(s.settings);
  // Unread reports of battles that have since dropped out of the list can never be opened: forget them.
  s.unseenReports ??= [];
  s.unseenReports = liveUnseenReports(s);
  s.moments ??= [];
  // Saves from before campaigns had ids share the one old autosave slot.
  s.campaign ??= 'old';
  // Saves from before rulers kept their crowning day: an unknown reign counts as just begun, so abdicating still
  // waits out its years (a new game's rulers of 1444 have theirs, day 0).
  for (const n of Object.values(s.nations)) if (n.ruler) n.ruler.crowned ??= s.day;
  return s;
}

/**
 * What stops the clock in a new game: what needs a decision (events) and the great turns of fortune (a war on you,
 * an ally attacked and calling you to arms, an ultimatum, the end). The rest (other offers, battles, sieges, arrivals)
 * drops in as a notice instead.
 */
export const DEFAULT_AUTOPAUSE: Record<PauseReason, boolean> = {
  warDeclaredOnYou: true,
  battleStarted: false,
  event: true,
  siegeWon: false,
  armyArrived: false,
  peaceOffer: false,
  ultimatum: true,
  allyAttacked: true,
  offer: false,
  gameOver: true,
};

/** Bumped when the pause settings of existing games change once on load (migrateSettings). */
export const PAUSE_SETTINGS_VERSION = 1;

/**
 * A saved game keeps its pause settings, with two one-time changes: a setting it has never seen (the ultimatum, an
 * ally's call to arms) takes its default, and offers (peace proposals and the rest), which used to stop the clock,
 * become notices. Toggled back on after that, they stay on.
 */
export function migrateSettings(set: GameSettings): GameSettings {
  set.autoPause = { ...DEFAULT_AUTOPAUSE, ...(set.autoPause ?? {}) };
  if ((set.pauseVersion ?? 0) < 1) {
    set.autoPause.peaceOffer = false;
    set.autoPause.offer = false;
  }
  set.pauseVersion = PAUSE_SETTINGS_VERSION;
  return set;
}

/** Starting fleets: [sea, galleys, transports]. */
const START_FLEETS: Record<NationId, [string, number, number]> = {
  VEN: ['adriatic', 10, 4],
  GEN: ['tyrrhenian', 6, 2],
  ENG: ['channel', 6, 6],
  POR: ['iberian_atlantic', 5, 4],
  ARA: ['west_med', 7, 3],
  CAS: ['biscay', 4, 3],
  TUR: ['aegean', 8, 4],
  DAN: ['baltic', 5, 2],
  HSA: ['baltic', 5, 2],
  NAP: ['tyrrhenian', 4, 2],
  KNI: ['aegean', 4, 0],
  TUN: ['ionian', 4, 1],
  BYZ: ['aegean', 3, 1],
  FRA: ['channel', 3, 2],
  SWE: ['baltic', 3, 1],
  BUR: ['north_sea', 3, 2],
  SCO: ['north_sea', 2, 1],
  TEU: ['baltic', 2, 1],
  CYP: ['levant', 2, 0],
  MOR: ['iberian_atlantic', 2, 1],
};

export interface NewGameOptions {
  player: NationId;
  difficulty?: GameSettings['difficulty'];
  ironman?: boolean;
  tutorial?: boolean;
  seed?: number;
  /** The campaign's id, for its own autosave; the store gives one to a new game that has none. */
  campaign?: string;
}

export function newGame(opts: NewGameOptions): GameState {
  const start = dayOf(SCENARIO.start.year, SCENARIO.start.month - 1, SCENARIO.start.day);
  const s: GameState = {
    version: SAVE_VERSION,
    day: start,
    rng: (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0,
    player: opts.player,
    settings: {
      difficulty: opts.difficulty ?? 'normal',
      ironman: !!opts.ironman,
      autoPause: { ...DEFAULT_AUTOPAUSE },
      tutorial: !!opts.tutorial,
      pauseVersion: PAUSE_SETTINGS_VERSION,
    },
    nations: {},
    regions: {},
    armies: {},
    fleets: {},
    battles: {},
    wars: {},
    relations: {},
    alliances: {},
    marriages: {},
    access: {},
    truces: {},
    cooldowns: {},
    coalitions: [],
    hre: { emperor: SCENARIO.hre.emperor, electors: [...SCENARIO.hre.electors], centralized: false },
    flags: {},
    firedEvents: {},
    pendingEvents: [],
    scheduledEvents: [],
    offers: [],
    reports: [],
    unseenReports: [],
    log: [],
    stats: { battlesWon: 0, battlesLost: 0, stackWipes: 0, bestWinRatio: 0, warsWon: 0, warsLost: 0, regionsConquered: 0, peakRegions: 0, menLost: 0, enemiesKilled: 0 },
    achievements: [],
    seq: 0,
    moments: [],
    ...(opts.campaign ? { campaign: opts.campaign } : {}),
  };

  for (const r of REGIONS) {
    const reg: Region = {
      id: r.id,
      owner: r.owner,
      controller: r.owner,
      dev: r.dev,
      fort: r.fort,
      faith: r.faith,
      unrest: 0,
      unrestMods: [],
      cores: r.owner ? [r.owner] : [],
      devBought: 0,
      natives: r.owner ? 0 : (r.natives ?? 0),
    };
    s.regions[r.id] = reg;
  }

  for (const def of NATIONS) {
    const nat: Nation = {
      id: def.id,
      alive: true,
      gold: 0,
      manpower: 0,
      stability: def.tier === 'minor' ? 1 : 1,
      prestige: def.tier === 'major' ? 20 : 10,
      threat: 0,
      loans: 0,
      ruler: { ...def.ruler, traits: [...def.ruler.traits], regency: 1444 - def.ruler.born < 16, crowned: 0 },
      heir: def.heir ? { ...def.heir, traits: [...def.heir.traits] } : undefined,
      faith: def.faith,
      capital: def.capital,
      claims: {},
      rivals: [],
      policies: [],
      era: 1,
      advances: startingAdvances(def.id),
      science: 0,
      researching: null,
      scienceFunding: 0,
      armyMode: 'peace',
      modifiers: [],
      flags: {},
      papalFavor: def.faith === 'catholic' ? 20 : 0,
      warExhaustion: 0,
      missionsDone: [],
      generals: [],
      recruiting: [],
      shipyard: [],
      lastEventDay: start - 200,
      electionDay: def.gov === 'republic' ? start + years(2 + (def.id.charCodeAt(0) % 4)) : undefined,
      lastMonthIncome: 0,
      lastMonthExpenses: 0,
      record: { battlesWon: 0, battlesLost: 0, warsWon: 0, warsLost: 0, stackWipes: 0, bestRatio: 0, regionsTaken: 0 },
      ai: { nextEval: start + (def.id.charCodeAt(0) * 7 + def.id.charCodeAt(1)) % 30 },
    };
    s.nations[def.id] = nat;
  }

  for (const nat of Object.values(s.nations)) {
    const dev = totalDev(s, nat.id);
    nat.gold = Math.round(40 + dev * 2.5);
    nat.manpower = Math.round(maxManpower(s, nat.id) * 0.7);
  }

  // Scenario relations.
  // The claims of 1444, each lapsing in the year its quarrel was settled (or would have to be pressed by then).
  for (const [n, list] of Object.entries(SCENARIO.claims)) for (const c of list) s.nations[n].claims[c.region] = dayOf(c.until, 0, 1);
  for (const [a, b] of SCENARIO.alliances) s.alliances[pairKey(a, b)] = start - years(5);
  for (const [a, b] of SCENARIO.marriages) s.marriages[pairKey(a, b)] = start - years(5);
  for (const [a, b] of SCENARIO.rivals) if (!s.nations[a].rivals.includes(b)) s.nations[a].rivals.push(b);
  for (const t of SCENARIO.truces) s.truces[pairKey(t.a, t.b)] = start + years(t.years);
  for (const sub of SCENARIO.subjects) {
    const n = s.nations[sub.subject];
    n.overlord = sub.overlord;
    n.subjectType = sub.type;
    n.subjectSince = start - years(sub.type === 'union' ? 0 : 5);
  }
  // Europe is just out of a round of wars and truces (Arras, Tours, Szeged): each crown made peace at some time in
  // the last three years, so the AI's first wars come one by one as their rests run out, not all in the first spring.
  for (const nat of Object.values(s.nations)) nat.ai.lastPeace = start - randInt(s, 0, years(3));

  // Starting armies: a share of each nation's force limit, at the capital.
  for (const nat of Object.values(s.nations)) {
    const def = NATION[nat.id];
    const fl = forceLimit(s, nat.id);
    const share = def.tier === 'minor' ? 0.5 : 0.65;
    const regs = Math.max(2, Math.round(fl * share));
    const cavShare = def.trait === 'steppe_horde' ? 0.6 : def.trait === 'szlachta' || def.trait === 'gendarmes' ? 0.35 : 0.25;
    const cav = Math.max(1, Math.round(regs * cavShare));
    // Crowns that already cast great guns in 1444 (Bombards) bring a siege train.
    const art = nat.advances.includes('bombards') ? Math.max(2, Math.round(regs * 0.15)) : 0;
    const inf = regs - cav - art;
    const army: Army = makeArmy(s, nat.id, nat.capital, inf, cav, art);
    if (def.tier !== 'minor') army.general = newGeneral(s, nat.id);
    s.armies[army.id] = army;
    // Big nations split their army between capital and a second, border region.
    if (regs >= 16) {
      const second = Object.values(s.regions)
        .filter(r => r.owner === nat.id && r.id !== nat.capital)
        .sort((a, b) => b.dev - a.dev)[0];
      if (second) {
        const take = Math.floor(inf / 3);
        army.regs.inf.n -= take;
        army.regs.inf.men -= take * 1000;
        const b = makeArmy(s, nat.id, second.id, take, Math.floor(cav / 3), 0);
        army.regs.cav.n -= Math.floor(cav / 3);
        army.regs.cav.men -= Math.floor(cav / 3) * 1000;
        s.armies[b.id] = b;
      }
    }
    const fl2 = START_FLEETS[nat.id];
    if (fl2) {
      const f: Fleet = {
        id: `f${++s.seq}`,
        name: `${def.adj} Fleet`,
        owner: nat.id,
        sea: fl2[0],
        ships: { galley: fl2[1], transport: fl2[2], warship: 0 },
        hull: 1,
        path: [],
        progress: 0,
        edgeDays: 0,
      };
      s.fleets[f.id] = f;
    }
    // AI nations start with a policy; the player picks their own.
    if (nat.id !== opts.player) nat.policies = [aiStartingPolicy(nat.id)];
  }

  // The modifiers read above came before the starting policies (a loaded game recomputes them; so does a new one).
  invalidateMods();
  for (const a of Object.values(s.armies)) a.morale = maxMorale(s, a.owner);
  s.stats.peakRegions = Object.values(s.regions).filter(r => r.owner === opts.player).length;
  bindDisplay(s);
  return s;
}

function aiStartingPolicy(n: NationId): string {
  const p = NATION[n].personality;
  const pick = p === 'trader' ? 'mercantilism' : p === 'expansionist' ? 'standing_army' : p === 'defensive' ? 'fortress_doctrine' : 'tax_reform';
  return POLICIES.find(x => x.id === pick)!.id;
}

export function makeArmy(s: GameState, owner: NationId, node: string, inf: number, cav: number, art: number, mercs = 0): Army {
  const nat = s.nations[owner];
  const no = nat ? (nat.flags._armyNo = (nat.flags._armyNo ?? 0) + 1) : ++s.seq;
  const label = nat && MAP_REGION[node] ? `${ordinalWord(no)} Army` : `Army of ${regionName(node)}`;
  return {
    id: `a${++s.seq}`,
    name: label,
    owner,
    node,
    regs: { inf: { n: inf, men: inf * 1000 }, cav: { n: cav, men: cav * 1000 }, art: { n: art, men: art * 1000 } },
    mercs,
    morale: 99, // clamped to max on the first tick
    path: [],
    progress: 0,
    edgeDays: 0,
  };
}

function ordinalWord(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
