/**
 * Game state and content types. The simulation is plain TypeScript with no React or platform imports:
 * the whole game is one serializable GameState mutated by advanceDay() and by player commands.
 */

export type NationId = string;
export type RegionId = string;
export type SeaId = string;
export type NodeId = string; // a RegionId or a SeaId
export type ArmyId = string;
export type FleetId = string;
export type WarId = string;
export type BattleId = string;

export type Faith = 'catholic' | 'orthodox' | 'muslim' | 'protestant' | 'native';
export type Terrain = 'plains' | 'forest' | 'hills' | 'marsh' | 'mountains';
export type Gov = 'monarchy' | 'republic' | 'theocracy';
export type Personality = 'expansionist' | 'defensive' | 'trader' | 'opportunist';
export type Tier = 'major' | 'hard' | 'minor';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'very_hard';
export type UnitType = 'inf' | 'cav' | 'art';
export type ShipType = 'galley' | 'warship' | 'transport';
/** What a New World region (or an Atlantic island) trades in: extra gold for its owner every month. */
export type Good = 'silver' | 'gold' | 'ivory' | 'sugar' | 'tobacco' | 'cocoa' | 'dyes' | 'furs' | 'fish' | 'grain';
export type CasusBelli = 'claim' | 'holy' | 'rival' | 'none' | 'independence' | 'coalition' | 'reconquest';

/** Additive modifiers. Percentages are fractions (0.1 = +10%). */
export type Modifiers = Partial<{
  taxIncome: number;
  tradeIncome: number;
  manpower: number;
  morale: number;
  infantryPower: number;
  cavalryPower: number;
  artilleryPower: number;
  fortDefense: number;
  siegeSpeed: number;
  attrition: number;
  upkeep: number;
  mercCost: number;
  devCost: number;
  coreCost: number;
  fortCost: number;
  shipCost: number;
  navalPower: number;
  threatDecay: number;
  threatGain: number;
  opinion: number;
  diplomacy: number;
  holyWarMorale: number;
  unrest: number;
  techCost: number;
  movement: number;
  prestigeGain: number;
  stabilityCost: number;
  colonists: number;
  settlerGrowth: number;
  science: number;
  forceLimit: number;
  warTechCost: number;
}>;

// ---------------------------------------------------------------- content

export interface RegionDef {
  id: RegionId;
  name: string;
  owner: NationId | null; // null: uncolonized land
  terrain: Terrain;
  dev: number; // for uncolonized land: the development a finished colony starts with
  fort: number;
  faith: Faith;
  hre?: boolean;
  trade?: boolean;
  natives?: number; // thousands of native people living on uncolonized land
  hostility?: number; // 0-3: how fiercely they resist settlers
  good?: Good;
  nw?: boolean; // in the New World: unknown until it is discovered
  /** The region's chief town (1444–1750) at its real place, drawn on the map once someone owns the region. */
  town: { name: string; lonlat: [number, number] };
  seeds: [number, number][];
}

export interface MapRegion {
  id: RegionId;
  path: string;
  label: [number, number];
  labelRadius: number;
  lonlat: [number, number];
  bbox: [number, number, number, number];
  area: number;
  neighbors: RegionId[];
  seas: SeaId[];
  /** Where its chief town stands (map units): its real place, nudged inside the region where the coast is coarse. */
  town: [number, number];
  townName: string;
}

export interface MapSea {
  id: SeaId;
  path: string;
  label: [number, number];
  bbox: number[];
  neighbors: SeaId[];
  closed?: boolean; // waters outside the game (drawn, never sailed)
  charted?: boolean; // a closed sea drawn as water rather than as parchment
}

export interface MapData {
  width: number;
  height: number;
  /** Spherical Mercator: x from `west` to `east` over `width` units, y = 0 at `north` (see scripts/build-map.ts). */
  projection: { type: 'mercator'; west: number; east: number; north: number; south: number };
  regions: MapRegion[];
  borders: { a: RegionId; b: RegionId; path: string }[];
  seas: MapSea[];
  wastelands: { id: string; path: string; label: [number, number]; area: number }[];
  lakes: { name: string; label: [number, number] }[];
  coast: string;
  /** Land beyond the play window: drawn as an outline for looks, never part of the game. */
  unknownWater: string; // waters no fleet can sail (drawn as parchment)
  uncharted: string; // the New World's regions, seas and lakes before it is found
  far: { path: string; coast: string; bbox: number[] }[];
  farLabels: { name: string; x: number; y: number; sea?: boolean }[];
  margin: [number, number]; // how far beyond the window the far lands are drawn (map units)
}

export interface RulerDef {
  name: string;
  born: number;
  skill: number;
  traits: string[];
}

/** A flag (drawn by ui/components/Flag.tsx): a field `pattern` in `colors` (the field first), and optionally a charge
 * (a figure) in `chargeColor` (default colors[1]); a quarterly flag puts its charge in quarters 1 and 4 and `charge2`
 * (in `charge2Color`, default colors[0]) in quarters 2 and 3. */
export interface FlagDef {
  pattern: string;
  colors: [string, string] | string[];
  charge?: string;
  chargeColor?: string;
  charge2?: string;
  charge2Color?: string;
  /** No flag or arms of this realm survive from about 1444: drawn for the game from its own symbols (said behind the
   * nation sheet's "?"). */
  stylised?: boolean;
}

export interface NationDef {
  id: NationId;
  name: string;
  adj: string;
  color: string;
  faith: Faith;
  capital: RegionId;
  gov: Gov;
  personality: Personality;
  trait: string;
  tier: Tier;
  playable: boolean;
  native?: boolean; // a New World people: no colonists, no European diplomacy, weaker troops
  difficulty: Difficulty | null;
  flag: FlagDef;
  ruler: RulerDef;
  heir?: RulerDef;
  desc: string;
  /** Where the nation picker lists it (a key of the picker's area labels). */
  area?: string;
}

/**
 * A greater crown (content/formables.json) a realm may proclaim once it holds enough of its lands: it takes the
 * crown's name, arms and (usually) colour, and gains its lasting bonus (crowns.ts).
 */
export interface CrownDef {
  id: string;
  name: string;
  adj: string;
  /** Its own map colour; missing: the proclaimer keeps its own. */
  color?: string;
  /** The nation whose colour this crown takes after: the crown's colour shows only if that nation proclaimed it or is gone. */
  inherits?: NationId;
  flag: FlagDef;
  regions: RegionId[];
  /** Regions it cannot be proclaimed without. */
  key: RegionId[];
  /** How many of `regions` must be held. */
  need: number;
  /** Who may proclaim it: nation tags, or the ids of smaller crowns that lead on to it. */
  formers: string[];
  /** The first year it may be proclaimed. */
  from?: number;
  /** Never proclaimed by the computer. */
  playerOnly?: boolean;
  /** Extra claims gained on proclaiming, beyond its own lands. */
  claims?: RegionId[];
  mods: Modifiers;
  bonus: string;
  blurb: string;
  history: string;
}

export interface TraitDef {
  name: string;
  desc: string;
  mods: Modifiers;
}

export interface PolicyDef {
  id: string;
  name: string;
  desc: string;
  requires?: string; // an advance that must be known first
  mods: Modifiers;
}

/** What an advance opens up besides its modifiers. */
export type AdvanceUnlock = 'artillery' | 'warships' | 'coastColonies' | 'oceanColonies';

/** One step of science (content/advances.json). */
export interface AdvanceDef {
  id: string;
  name: string;
  field: 'war' | 'sea' | 'state';
  year: number; // when the most learned crowns had it historically; earlier costs more
  cost: number; // science, before the early/late and neighbour factors
  requires: string[];
  desc: string;
  mods?: Modifiers;
  unlock?: AdvanceUnlock;
  armyEra?: number; // troops of this age (units.json eras)
}

/** An age of troops, reached through the war advances (Pike and Shot, Musket and Volley, Flintlock and Bayonet). */
export interface UnitEra {
  id: number;
  name: string;
  morale: number;
  inf: { name: string; power: number };
  cav: { name: string; power: number };
  art: { name: string; power: number } | null;
  warships: boolean;
}

// ---------------------------------------------------------------- events & missions DSL

/** Conditions are evaluated for one nation ("this nation"). */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { year: [number, number] | [number] }
  | { isNation: NationId | NationId[] }
  | { isPlayer: boolean }
  | { owns: RegionId | RegionId[] }
  | { ownsAny: RegionId[] }
  | { controls: RegionId }
  | { nationOwns: { nation: NationId; region: RegionId } }
  | { exists: NationId }
  | { atWar: boolean }
  | { atWarWith: NationId }
  | { truceWith: NationId }
  | { faith: Faith }
  | { nationFaith: { nation: NationId; faith: Faith } }
  | { stability: [number, number] }
  | { goldAtLeast: number }
  | { prestigeAtLeast: number }
  | { threatAtLeast: number }
  | { regionsAtLeast: number }
  | { regimentsAtLeast: number }
  | { devAtLeast: number }
  | { capitalDevAtLeast: number }
  | { allied: NationId }
  | { alliesAtLeast: number }
  | { borders: NationId }
  | { rulerSkill: [number, number] }
  | { rulerAgeAtLeast: number }
  | { hasHeir: boolean }
  | { eraAtLeast: number }
  | { flag: string }
  | { nationFlag: string }
  | { loansAtLeast: number }
  | { isEmperor: boolean }
  | { isElector: boolean }
  | { subjectOf: NationId | true }
  | { overlordOf: NationId | true }
  | { vassalsAtLeast: number }
  | { regionFaith: { region: RegionId; faith: Faith } }
  | { faithRegionsAtLeast: { faith: Faith; count: number } }
  | { gov: Gov }
  | { tier: Tier }
  | { hasPolicy: string }
  | { hasAdvance: string }
  | { warsWonAtLeast: number }
  | { battlesWonAtLeast: number }
  | { stackWipesAtLeast: number }
  | { bestWinRatioAtLeast: number }
  | { regionsConqueredAtLeast: number }
  | { fleetsAtLeast: number }
  | { shipsAtLeast: number }
  | { coastal: boolean }
  | { inCoalition: boolean }
  | { coalitionAgainst: boolean }
  | { hreMember: boolean }
  | { papalFavorAtLeast: number }
  | { discovered: boolean }
  | { coloniesAtLeast: number }
  | { colonizingAtLeast: number }
  | { ownsGood: Good }
  | { native: boolean }
  | { chance: number };

export interface TimedModifier {
  id: string;
  name: string;
  mods: Modifiers;
  until: number; // day; -1 = permanent
}

export type Effect =
  | { gold: number }
  | { goldPerDev: number }
  | { manpower: number }
  | { stability: number }
  | { prestige: number }
  | { science: number }
  | { threat: number }
  | { papalFavor: number }
  | { warExhaustion: number }
  | { addClaim: RegionId | RegionId[] }
  | { addCore: RegionId | RegionId[] }
  | { devRegion: { region: RegionId; amount: number } }
  | { devCapital: number }
  | { fortRegion: { region: RegionId; amount: number } }
  | { unrestAll: number }
  | { unrestRegion: { region: RegionId; amount: number } }
  | { convertRegion: { region: RegionId; faith: Faith } }
  | { changeFaith: Faith }
  | { setFlag: string }
  | { clearFlag: string }
  | { setNationFlag: string }
  | { modifier: { id: string; name: string; months: number; mods: Modifiers } }
  | { removeModifier: string }
  | { rebels: { region?: RegionId; regiments: number } }
  | { addRegiments: { inf?: number; cav?: number; art?: number; region?: RegionId } }
  | { hireGeneral: { stars: number; name?: string } }
  | { opinion: { nation: NationId; amount: number } }
  | { ally: NationId }
  | { breakAlliance: NationId }
  | { personalUnion: NationId }
  | { inherit: NationId }
  | { independence: true }
  | { releaseSubject: NationId }
  | { transferRegion: { region: RegionId; to: NationId } }
  | { newRuler: { name: string; skill: number; traits?: string[]; age?: number } }
  | { rulerSkill: number }
  | { rulerTrait: string }
  | { killRuler: true }
  | { newHeir: { name: string; skill: number; traits?: string[]; age?: number } }
  | { triggerEvent: { id: string; months?: number; nation?: NationId } }
  | { reformation: number }
  | { declareWar: { target: NationId; cb?: CasusBelli; region?: RegionId; with?: NationId | NationId[] } }
  | { loans: number }
  | { emperor: true }
  | { discoverNewWorld: true }
  | { settlers: number }
  | { settlersOne: number };

export interface EventChoice {
  text: string;
  effects: Effect[];
  ai?: number; // relative weight for AI picks (default 1)
}

export interface EventDef {
  id: string;
  pool: 'historical' | 'generic' | 'era';
  title: string;
  text: string;
  image: string;
  nations?: NationId[]; // only these nations can get it
  window?: [number, number]; // years
  mtth?: number; // mean months to happen once eligible (default 36)
  once?: boolean; // fires at most once per game (historical events default true)
  news?: string; // shown to the player when an AI nation gets this event
  hidden?: boolean; // only fired by triggerEvent, never on its own
  onPeace?: boolean; // also checked on the day a peace is signed, not only at the monthly pass
  trigger: Condition;
  choices: EventChoice[];
}

export interface MissionDef {
  id: string;
  nation: NationId | 'generic';
  title: string;
  desc: string;
  requires: string[];
  goal: Condition;
  reward: Effect[];
}

/** A historical aim of an AI crown (content/aims.json): land it wants while the years fit. */
export interface AimDef {
  id: string;
  nation: NationId;
  title: string;
  regions: RegionId[];
  from?: number;
  until?: number;
}

/** An old friendship or enmity between two crowns that colours their opinion of each other. */
export interface BondDef {
  a: NationId;
  b: NationId;
  kind: 'friends' | 'foes';
  label: string;
  from?: number;
  until?: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  goal: Condition;
  nations?: NationId[];
}

// ---------------------------------------------------------------- state

export interface Ruler {
  name: string;
  born: number; // year
  skill: number; // 1..5
  traits: string[];
  regency?: boolean;
  /** The day they took the throne (missing for the rulers of 1444 and older saves: read as day 0). */
  crowned?: number;
}

export interface General {
  id: string;
  name: string;
  stars: number; // 1-5: each star is +10% to everything the army does (STAR_BONUS in rulers.ts)
  hired: number; // day
  lifespan: number; // days of service before retiring
  isRuler?: boolean;
}

export interface Regs {
  n: number; // regiments
  men: number; // current men (full strength = n * 1000)
}

export interface Army {
  id: ArmyId;
  name: string;
  owner: NationId;
  node: NodeId; // where it is (or departed from)
  regs: Record<UnitType, Regs>;
  mercs: number; // how many regiments are mercenaries
  morale: number; // current morale (max depends on era & modifiers)
  general?: General;
  path: NodeId[]; // remaining nodes to walk, path[0] = next node
  progress: number; // days walked on the current edge
  edgeDays: number; // total days for the current edge
  battle?: BattleId;
  retreating?: boolean;
  from?: NodeId; // the node it last left (for river crossings)
  arrivedDay?: number; // the day it last entered a node (or mustered): the army that moved in today is the attacker
  homeward?: NodeId; // marching home at peace through land it has no access to (access isn't checked on the way)
  rebelOf?: NationId; // rebel armies: who they rebel against
  rebelSince?: number;
  stance?: 'hold';
  aiTask?: string;
  aiUntil?: number;
}

export interface Fleet {
  id: FleetId;
  name: string;
  owner: NationId;
  sea: SeaId;
  ships: Record<ShipType, number>;
  hull: number; // 0..1
  path: SeaId[];
  progress: number;
  edgeDays: number;
  retreating?: boolean;
}

export interface BattleSide {
  armies: ArmyId[];
  nations: NationId[];
  startMen: number;
  losses: number;
  roll: number;
}

export interface Battle {
  id: BattleId;
  node: RegionId;
  started: number;
  days: number;
  sides: [BattleSide, BattleSide]; // 0 = attacker, 1 = defender
  river: boolean;
  pitched?: boolean; // both sides were already standing there (a war declared, rebels rising): no attacker penalty
  log: { day: number; rolls: [number, number]; losses: [number, number] }[];
  /** The two sides as the battle opened (for the report's "why"). */
  opening?: { morale: [number, number]; stars: [number, number]; era: [number, number]; regs: [number, number] };
}

export interface BattleReport {
  id: string;
  day: number;
  node: RegionId;
  winner: 0 | 1;
  leaders: [NationId, NationId];
  nations: [NationId[], NationId[]];
  startMen: [number, number];
  losses: [number, number];
  wiped: boolean;
  scattered?: boolean; // the beaten army had nowhere to retreat and scattered (its men count as losses)
  scatteredMen?: number; // how many of the losses were men of the armies that scattered
  days: number;
  generals: [string | null, string | null];
  warScore: number; // points gained by the winner's side
  playerSide: 0 | 1 | null;
  /** What decided it, from the sides as they opened: shown under the report. */
  why?: { terrain: Terrain; penalty: number; river: boolean; pitched: boolean; morale: [number, number]; stars: [number, number]; era: [number, number]; regs: [number, number] };
}

export interface Siege {
  by: NationId;
  progress: number; // 0..1
  started: number;
}

/** How a colony's settlers deal with the natives: trade with them, or take the land by force (colonies.ts). */
export type NativePolicy = 'trade' | 'force';

export interface Colony {
  by: NationId;
  settlers: number; // a colony is founded at 1,000
  started: number; // day
  /** Missing: 'force' (every colony before the choice existed). A trading colony may turn to force, never back. */
  policy?: NativePolicy;
  /** Natives (thousands) on the land when the colony began: trading, they join it at founding. */
  natives0?: number;
  /** A paid company of guards (COLONY_GUARD_UPKEEP a month): the natives don't attack. */
  guard?: boolean;
}

/** A colonist sent to one of its crown's founded New World regions to raise its prosperity (colonies.ts). */
export interface Growing {
  by: NationId;
  settlers: number; // +1 prosperity every GROW_SETTLERS, then it starts again
  started: number; // day
}

export interface Region {
  id: RegionId;
  owner: NationId | null; // null: uncolonized
  controller: NationId | null; // differs from owner while occupied
  dev: number;
  fort: number;
  faith: Faith;
  unrest: number;
  /** Timed unrest (`why`: the breakdown's label, else "Recent events"). */
  unrestMods: { amount: number; until: number; why?: string }[];
  cores: NationId[];
  conquered?: number; // day it changed hands (cores itself after 20 years)
  siege?: Siege;
  converting?: { to: Faith; done: number };
  blockaded?: boolean;
  devBought: number;
  natives: number; // thousands, on uncolonized land
  colony?: Colony;
  growing?: Growing;
  lastRaid?: number; // day an enemy army last raided the colony being settled here
  university?: boolean;
}

export interface War {
  id: WarId;
  name: string;
  attackers: NationId[]; // [0] is the war leader
  defenders: NationId[];
  cb: CasusBelli;
  goal?: RegionId;
  started: number;
  battleScore: number; // attacker-side points from battles (+ attacker, - defender)
  goalScore: number; // ticking score from holding (or failing to take) the war goal
  /** An AI leader's ultimatum to the player: imposed on `due` if it still holds ULTIMATUM_SCORE (war.ts). */
  ultimatum?: { from: NationId; due: number; terms: PeaceTerms };
  /** Declared (by the AI) for the war goal alone, a region on its border: if the attackers win, the goal is all the
   * land they take (buildDemands). */
  limited?: boolean;
  /** Who started it: the AI's own decision, a coalition, an event, a subject breaking free or the player (absent on
   * wars from older saves). */
  origin?: 'ai' | 'coalition' | 'event' | 'independence' | 'player';
  /** Declared in breach of a truce: no ally answers its leader's call. */
  brokeTruce?: boolean;
}

export interface Relation {
  opinionMods: { id: string; name: string; value: number; decay: number }[];
}

export interface Nation {
  id: NationId;
  alive: boolean;
  gold: number;
  manpower: number;
  stability: number;
  prestige: number;
  threat: number;
  loans: number;
  ruler: Ruler;
  heir?: Ruler;
  faith: Faith;
  capital: RegionId;
  claims: Record<RegionId, number>; // expiry day, -1 = permanent
  fabricating?: { region: RegionId; done: number };
  rivals: NationId[];
  overlord?: NationId;
  subjectType?: 'vassal' | 'union';
  subjectSince?: number;
  policies: string[];
  policySwappedEra?: number;
  era: number; // age of its troops (1-4), raised by the war advances
  advances: string[];
  science: number; // banked toward the next advance
  researching: string | null;
  scienceFunding: number; // 0-3, see FUNDING in science.ts
  armyMode: 'peace' | 'war';
  modifiers: TimedModifier[];
  flags: Record<string, number>;
  papalFavor: number;
  warExhaustion: number;
  missionsDone: string[];
  generals: General[];
  recruiting: { type: UnitType; region: RegionId; done: number }[];
  shipyard: { type: ShipType; region: RegionId; sea: SeaId; done: number }[];
  expedition?: { done: number }; // a voyage west, before the New World is found
  lastEventDay: number;
  electionDay?: number;
  lastMonthIncome: number;
  lastMonthExpenses: number;
  record: { battlesWon: number; battlesLost: number; warsWon: number; warsLost: number; stackWipes: number; bestRatio: number; regionsTaken: number };
  ai: { nextEval: number; warTarget?: NationId; saving?: number; lastWarDeclared?: number; lastPeace?: number; colonyLevy?: number; warRoll?: number };
  /** Days it declared wars without a reason (the last 10 years count: each makes the next one cost more Threat). */
  unjustWars?: number[];
  /** The latest greater crown it proclaimed (a CrownDef id): its name, arms and colour show instead of its own. */
  crown?: string;
  /** Its golden age (once a game, realm.ts): fifty years of plenty from `since`; `over` once its end is told. */
  golden?: { since: number; until: number; over?: boolean };
}

export interface Coalition {
  target: NationId;
  members: NationId[];
  formed: number;
}

export interface PendingEvent {
  event: string;
  nation: NationId;
  day: number;
}

export type Offer =
  | { id: string; kind: 'callToArms'; from: NationId; war: WarId; day: number }
  | { id: string; kind: 'peace'; from: NationId; war: WarId; day: number; terms: PeaceTerms; ultimatum?: number } // ultimatum: the day it takes effect
  | { id: string; kind: 'alliance' | 'marriage' | 'access'; from: NationId; day: number };

export interface PeaceTerms {
  regions: RegionId[];
  gold: number;
  vassalize: boolean;
  release: NationId[];
  white?: boolean;
  /** whose demands: the side that receives the regions/gold */
  winner: NationId;
  loser: NationId;
}

export interface LogEntry {
  id: number;
  day: number;
  text: string;
  kind: 'war' | 'peace' | 'battle' | 'siege' | 'diplomacy' | 'event' | 'economy' | 'ruler' | 'news' | 'rebels' | 'mission' | 'colony';
  node?: NodeId;
  nation?: NationId;
  important?: boolean;
}

export type PauseReason =
  | 'warDeclaredOnYou'
  | 'battleStarted'
  | 'event'
  | 'siegeWon'
  | 'armyArrived'
  | 'peaceOffer'
  | 'ultimatum'
  | 'allyAttacked'
  | 'offer'
  | 'gameOver';

export interface Stats {
  battlesWon: number;
  battlesLost: number;
  stackWipes: number;
  bestWinRatio: number;
  warsWon: number;
  warsLost: number;
  regionsConquered: number;
  peakRegions: number;
  menLost: number;
  enemiesKilled: number;
}

export interface GameSettings {
  difficulty: 'easy' | 'normal' | 'hard';
  ironman: boolean;
  autoPause: Record<PauseReason, boolean>;
  tutorial: boolean;
  /** Which one-time changes to the pause settings this game has had (PAUSE_SETTINGS_VERSION in state.ts). */
  pauseVersion?: number;
}

export interface GameState {
  version: number;
  day: number; // days since 1 Jan 1444
  rng: number;
  player: NationId;
  settings: GameSettings;
  nations: Record<NationId, Nation>;
  regions: Record<RegionId, Region>;
  armies: Record<ArmyId, Army>;
  fleets: Record<FleetId, Fleet>;
  battles: Record<BattleId, Battle>;
  wars: Record<WarId, War>;
  relations: Record<string, Relation>; // directed "A>B": how A feels about B
  alliances: Record<string, number>; // "A|B" sorted -> since day
  marriages: Record<string, number>;
  access: Record<string, number>; // "A>B": A lets B's armies through
  truces: Record<string, number>; // "A|B" sorted -> until day
  cooldowns: Record<string, number>; // "A>B:action" -> day available again
  coalitions: Coalition[];
  hre: { emperor: NationId | null; electors: NationId[]; centralized: boolean; rulerKey?: string };
  discovery?: { day: number; by: NationId | null }; // when the New World was found, and by whom
  flags: Record<string, number>;
  firedEvents: Record<string, number>; // event id -> times fired (once-events)
  pendingEvents: PendingEvent[]; // the player's event cards waiting to be answered
  scheduledEvents: { event: string; nation: NationId; day: number }[];
  offers: Offer[]; // AI proposals waiting on the player
  reports: BattleReport[]; // recent battle reports, newest first
  unseenReports: string[]; // reports the player hasn't opened
  log: LogEntry[];
  stats: Stats;
  achievements: string[]; // unlocked in this campaign
  seq: number; // id counter
  gameOver?: { reason: 'annexed' | 'end'; day: number };
  /** The great turns of the game, newest last, shown as a card or a banner (log.ts moment()). */
  moments?: Moment[];
  /** Which campaign this game is (set by the app when it starts one): one autosave per campaign. */
  campaign?: string;
}

export type MomentKind = 'golden' | 'peace' | 'mission' | 'achievement' | 'crown' | 'union' | 'ruler' | 'capital' | 'fortress' | 'rebels' | 'invaded' | 'headline';

/** A great turn of the game: a card when the player caused it or is a principal in it, otherwise a banner. */
export interface Moment {
  id: string;
  day: number;
  kind: MomentKind;
  card: boolean;
  tone: 'good' | 'bad' | 'info';
  title: string;
  lines?: string[];
  gained?: RegionId[];
  lost?: RegionId[];
  node?: NodeId;
  nation?: NationId;
}

export interface TickResult {
  pause: PauseReason[];
  mapChanged: boolean;
}
