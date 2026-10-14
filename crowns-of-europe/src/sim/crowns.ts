/**
 * Greater crowns (content/formables.json): a realm that holds enough of a crown's lands may proclaim it, taking its
 * name, arms, usually its colour, and a lasting bonus. Naples → Two Sicilies → Italy → Roman Empire, Spain for the
 * Iberians, and so on. No randomness: the computer proclaims the first crown it is ready for, every January.
 */
import { CROWN, CROWNS, NATION, displayIn, regionName } from './content';
import { log, moment } from './log';
import { invalidateMods, subjectsOf, warsOf } from './queries';
import { annexNation, markMapDirty } from './territory';
import type { CrownDef, GameState, NationId, RegionId } from './types';
import { dateOf, years } from './util';

/** How near a realm is to a crown it may aim at. */
export interface CrownProgress {
  id: string;
  held: number;
  need: number;
  keysMissing: RegionId[];
  ready: boolean;
  /** Why it cannot be proclaimed yet, if it cannot. */
  why?: string;
}

/** Renown for proclaiming a crown. */
export const CROWN_RENOWN = 20;
/** How long the claims on a new crown's missing lands last. */
export const CROWN_CLAIM_YEARS = 25;

/** Crowns whose name reads with "the" in a sentence ("Naples proclaims the Two Sicilies"). */
const THE = new Set(['SIC', 'ROM', 'NED', 'GHO', 'PLC', 'SRB', 'RUM', 'ARB', 'MAG', 'JER', 'BRG', 'IRL']);
/** A crown's name as it reads mid-sentence. */
export const crownTitle = (id: string): string => (THE.has(id) ? `the ${CROWN[id].name}` : CROWN[id].name);

/** Who proclaimed crown `id` this game, and when (undefined: nobody yet). */
export function proclaimedBy(s: GameState, id: string): { by: NationId; day: number } | undefined {
  const day = s.flags['crown_' + id];
  if (day === undefined) return undefined;
  const by = Object.keys(s.nations).find(k => s.nations[k].flags['crown_' + id] !== undefined);
  return by ? { by, day } : undefined;
}

/** Does `n` hold region `r`, itself or through a junior partner in a shared crown (never through the player)? */
function holds(s: GameState, n: NationId, r: RegionId): boolean {
  const owner = s.regions[r]?.owner;
  if (!owner) return false;
  if (owner === n) return true;
  if (owner === s.player) return false;
  const o = s.nations[owner];
  return o?.overlord === n && o.subjectType === 'union';
}

/** May `n`'s present crown (or, before any, `n` itself) lead on to crown `c`? */
const mayAim = (s: GameState, n: NationId, c: CrownDef): boolean => c.formers.includes(s.nations[n]?.crown ?? n);

/** Null if `n` may proclaim crown `id` now, otherwise the reason it may not. */
export function canProclaim(s: GameState, n: NationId, id: string): string | null {
  const c = CROWN[id];
  const nat = s.nations[n];
  if (!c || !nat?.alive) return 'No such crown';
  const taken = proclaimedBy(s, id);
  if (taken) return taken.by === n ? 'You already hold it' : `Proclaimed by ${NATION[taken.by]?.name ?? taken.by}`;
  if (c.playerOnly && n !== s.player) return 'Only for players';
  if (!mayAim(s, n, c)) return `Not open to ${displayIn(s, n).name}`;
  return readiness(s, n, c).why ?? null;
}

/** The lands, keys and conditions of the moment (checks 4-9 of canProclaim). */
function readiness(s: GameState, n: NationId, c: CrownDef): CrownProgress {
  const nat = s.nations[n];
  const held = c.regions.filter(r => holds(s, n, r)).length;
  const keysMissing = c.key.filter(r => !holds(s, n, r));
  let why: string | undefined;
  if (c.from && dateOf(s.day).year < c.from) why = `Not before ${c.from}`;
  else if (nat.overlord) why = 'Not while a subject';
  else if (warsOf(s, n).length) why = 'Not while at war';
  else if (nat.stability < 0) why = 'Needs order 0 or better';
  else if (keysMissing.length) why = `Needs ${keysMissing.map(regionName).join(' and ')}`;
  else if (held < c.need) why = `Needs ${c.need} of its lands`;
  return { id: c.id, held, need: c.need, keysMissing, ready: !why, why };
}

/** The crowns `n` may aim at (its crown may lead on to them, and nobody has proclaimed them), and how near it is. */
export function crownProgress(s: GameState, n: NationId): CrownProgress[] {
  if (!s.nations[n]?.alive) return [];
  return CROWNS.filter(c => mayAim(s, n, c) && !proclaimedBy(s, c.id) && (!c.playerOnly || n === s.player)).map(c =>
    readiness(s, n, c),
  );
}

/** `n` proclaims crown `id` (call only when canProclaim allows it). */
export function proclaim(s: GameState, n: NationId, id: string): void {
  const c = CROWN[id];
  const nat = s.nations[n];
  const was = displayIn(s, n).name;
  nat.crown = id;
  s.flags['crown_' + id] = s.day;
  nat.flags['crown_' + id] = s.day;
  // A lasting bonus; a chain's bonuses stack.
  nat.modifiers = nat.modifiers.filter(m => m.id !== 'crown_' + id);
  nat.modifiers.push({ id: 'crown_' + id, name: c.name, mods: c.mods, until: -1 });
  invalidateMods();
  // Junior partners holding the crown's lands are joined to it (never a player).
  const lands = new Set(c.regions);
  for (const sub of subjectsOf(s, n)) {
    if (sub === s.player || s.nations[sub].subjectType !== 'union') continue;
    if (Object.values(s.regions).some(r => r.owner === sub && lands.has(r.id))) annexNation(s, n, sub);
  }
  // Claims on the lands still to win, never shortening a longer one.
  const until = s.day + years(CROWN_CLAIM_YEARS);
  for (const r of [...c.regions, ...(c.claims ?? [])]) {
    const owner = s.regions[r]?.owner;
    if (!owner || owner === n || s.nations[owner]?.overlord === n) continue;
    const had = nat.claims[r];
    if (had === -1 || (had !== undefined && had >= until)) continue;
    nat.claims[r] = until;
  }
  nat.prestige = Math.min(100, nat.prestige + CROWN_RENOWN);
  const mine = n === s.player;
  log(s, 'news', `${mine ? 'You proclaim' : `${was} proclaims`} ${crownTitle(id)}.`, {
    nation: n,
    node: nat.capital,
    important: true,
  });
  moment(s, {
    kind: 'crown',
    card: mine,
    tone: mine ? 'good' : 'info',
    title: c.name,
    lines: [`${was} proclaims ${crownTitle(id)}.`, `${c.bonus[0].toUpperCase()}${c.bonus.slice(1)}`],
    nation: n,
    node: nat.capital,
  });
  markMapDirty();
}

/** Every month: the player hears of a crown newly within reach; every January the computer's realms proclaim theirs. */
export function monthlyCrowns(s: GameState): void {
  const me = s.nations[s.player];
  if (me?.alive)
    for (const p of crownProgress(s, s.player)) {
      if (!p.ready || me.flags['crown_ready_' + p.id] !== undefined) continue;
      me.flags['crown_ready_' + p.id] = s.day;
      log(s, 'news', `You may proclaim ${crownTitle(p.id)}. See Realm.`, { nation: s.player, important: true });
    }
  if (dateOf(s.day).month !== 0 || '__noAI' in s.flags) return;
  for (const n of Object.keys(s.nations).sort()) {
    if (n === s.player || !s.nations[n].alive) continue;
    const c = CROWNS.find(x => canProclaim(s, n, x.id) === null);
    if (c) proclaim(s, n, c.id);
  }
}
