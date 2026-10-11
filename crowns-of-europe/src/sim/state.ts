/** Creates a fresh 1444 campaign from the bundled scenario. */
import { MAP_REGION, NATION, NATIONS, POLICIES, REGIONS, SCENARIO, regionName } from './content';
import { forceLimit, maxMorale, totalDev } from './queries';
import type { Army, Fleet, GameSettings, GameState, Nation, NationId, PauseReason, Region } from './types';
import { dayOf, years, pairKey } from './util';
import { newGeneral } from './rulers';
import { maxManpower } from './economy';

export const SAVE_VERSION = 2;

export const DEFAULT_AUTOPAUSE: Record<PauseReason, boolean> = {
  warDeclaredOnYou: true,
  battleStarted: false,
  event: true,
  siegeWon: false,
  armyArrived: false,
  peaceOffer: true,
  offer: true,
  gameOver: true,
};

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
      ruler: { ...def.ruler, traits: [...def.ruler.traits], regency: 1444 - def.ruler.born < 16 },
      heir: def.heir ? { ...def.heir, traits: [...def.heir.traits] } : undefined,
      faith: def.faith,
      capital: def.capital,
      claims: {},
      rivals: [],
      policies: [],
      era: 1,
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
  for (const [n, regions] of Object.entries(SCENARIO.claims)) for (const r of regions) s.nations[n].claims[r] = -1;
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

  // Starting armies: a share of each nation's force limit, at the capital.
  for (const nat of Object.values(s.nations)) {
    const def = NATION[nat.id];
    const fl = forceLimit(s, nat.id);
    const share = def.tier === 'minor' ? 0.5 : 0.65;
    const regs = Math.max(2, Math.round(fl * share));
    const cavShare = def.trait === 'steppe_horde' ? 0.6 : def.trait === 'szlachta' || def.trait === 'gendarmes' ? 0.35 : 0.25;
    const cav = Math.max(1, Math.round(regs * cavShare));
    const inf = regs - cav;
    const army: Army = makeArmy(s, nat.id, nat.capital, inf, cav, 0);
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

  for (const a of Object.values(s.armies)) a.morale = maxMorale(s, a.owner);
  s.stats.peakRegions = Object.values(s.regions).filter(r => r.owner === opts.player).length;
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
