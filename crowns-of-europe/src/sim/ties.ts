/**
 * Everything that binds one crown to the others, in one read for the Diplomacy tab: claims both ways, marriages,
 * military access, truces, rivals, old friends and foes, and the crowns that could march on it. Pure: no draws.
 */
import { nationName, regionName } from './content';
import { warOdds } from './ai';
import { bondsOf, holds } from './aims';
import { aliveNations, allied, alliesOf, married, neighborsOf, subjectsOf } from './queries';
import { coalitionAgainst, coalitionOf } from './threat';
import type { Coalition, GameState, NationId, RegionId } from './types';
import { claimReason } from './war';
import { years } from './util';

/** Access lapses this long after it was granted (diplomacy.ts prunes it monthly). */
const ACCESS_YEARS = 10;

export interface ClaimTie {
  region: RegionId;
  /** Who holds the land now (null: nobody, uncolonized). */
  holder: NationId | null;
  /** The crown that holds the claim. */
  by: NationId;
  /** The day it lapses, -1 for never. */
  until: number;
  /** The quarrel of 1444 behind it, while it is that claim. */
  why?: string;
}
export interface DatedTie {
  nation: NationId;
  until: number;
}
export interface BondTie {
  nation: NationId;
  label: string;
}
export interface ThreatTie {
  nation: NationId;
  /** The chance it declares on its roll day this month (0 while it waits). */
  monthly: number;
  /** It waits out a truce with you, holding a claim on your land, until this day. */
  waitingUntil?: number;
  /** It holds a claim on your land but rests from its last war until this day. */
  restingUntil?: number;
}
export interface Ties {
  overlord?: { nation: NationId; union: boolean };
  allies: NationId[];
  subjects: NationId[];
  marriages: NationId[];
  yourClaims: ClaimTie[];
  claimsOnYou: ClaimTie[];
  forging?: { region: RegionId; holder: NationId | null; done: number };
  /** They let your armies through. */
  accessYouHave: DatedTie[];
  /** You let theirs through. */
  accessYouGive: DatedTie[];
  truces: DatedTie[];
  rivalsYouNamed: NationId[];
  rivalsOfYou: NationId[];
  oldFriends: BondTie[];
  oldFoes: BondTie[];
  couldAttack: ThreatTie[];
  coalitionAgainst?: Coalition;
  coalitionIn?: Coalition;
}

const byName = (a: NationId, b: NationId) => nationName(a).localeCompare(nationName(b));
/** Soonest to lapse first, the ones that never do last. */
const bySoonest = (a: number, b: number) => (a < 0 ? Infinity : a) - (b < 0 ? Infinity : b);

export function diplomaticTies(s: GameState, n: NationId): Ties {
  const me = s.nations[n];
  const alive = (x: NationId) => !!s.nations[x]?.alive;
  const subjects = subjectsOf(s, n).sort(byName);
  // A claim past its day gives no reason for war (war.ts), though the monthly sweep has not removed it yet.
  const lapsed = (until: number) => until >= 0 && until <= s.day;

  const yourClaims: ClaimTie[] = [];
  for (const [region, until] of Object.entries(me.claims)) {
    const holder = s.regions[region]?.owner ?? null;
    if (holder === n || lapsed(until)) continue;
    yourClaims.push({ region, holder, by: n, until, why: claimReason(s, n, region) });
  }
  yourClaims.sort((a, b) => bySoonest(a.until, b.until) || regionName(a.region).localeCompare(regionName(b.region)));

  const claimsOnYou: ClaimTie[] = [];
  for (const other of aliveNations(s)) {
    if (other.id === n) continue;
    for (const [region, until] of Object.entries(other.claims))
      if (holds(s, n, region) && !lapsed(until)) claimsOnYou.push({ region, holder: s.regions[region].owner, by: other.id, until, why: claimReason(s, other.id, region) });
  }
  claimsOnYou.sort((a, b) => byName(a.by, b.by) || bySoonest(a.until, b.until) || regionName(a.region).localeCompare(regionName(b.region)));

  const accessYouHave: DatedTie[] = [];
  const accessYouGive: DatedTie[] = [];
  for (const [k, since] of Object.entries(s.access)) {
    const [from, to] = k.split('>');
    const until = since + years(ACCESS_YEARS);
    if (to === n && alive(from)) accessYouHave.push({ nation: from, until });
    else if (from === n && alive(to)) accessYouGive.push({ nation: to, until });
  }
  const byDate = (a: DatedTie, b: DatedTie) => a.until - b.until || byName(a.nation, b.nation);
  accessYouHave.sort(byDate);
  accessYouGive.sort(byDate);

  const truces: DatedTie[] = [];
  for (const [k, until] of Object.entries(s.truces)) {
    if (until <= s.day) continue;
    const [a, b] = k.split('|');
    const other = a === n ? b : b === n ? a : null;
    if (other && alive(other)) truces.push({ nation: other, until });
  }
  truces.sort(byDate);

  const marriages = aliveNations(s)
    .filter(x => x.id !== n && married(s, n, x.id))
    .map(x => x.id)
    .sort(byName);
  const rivalsYouNamed = me.rivals.filter(alive).sort(byName);
  const rivalsOfYou = aliveNations(s)
    .filter(x => x.id !== n && x.rivals.includes(n))
    .map(x => x.id)
    .sort(byName);

  const oldFriends: BondTie[] = [];
  const oldFoes: BondTie[] = [];
  for (const b of bondsOf(s, n)) (b.kind === 'friends' ? oldFriends : oldFoes).push({ nation: b.a === n ? b.b : b.a, label: b.label });
  oldFriends.sort((a, b) => byName(a.nation, b.nation));
  oldFoes.sort((a, b) => byName(a.nation, b.nation));

  // Only your neighbours are weighed: a crown marches only on a neighbour, and on the overlord, never the subject
  // (ai.ts bestWarTarget, truceToWaitOut), so a threat to your subjects' land is a threat to you, from next door.
  const claimants = new Set(claimsOnYou.map(c => c.by));
  const couldAttack: ThreatTie[] = [];
  for (const o of neighborsOf(s, n).sort()) {
    if (!alive(o)) continue;
    const odds = warOdds(s, o);
    if (odds.blocked === 'waiting' && odds.waitingFor === n) couldAttack.push({ nation: o, monthly: 0, waitingUntil: odds.restUntil });
    else if (odds.blocked === 'rest' && odds.restUntil !== undefined && claimants.has(o) && !allied(s, n, o))
      couldAttack.push({ nation: o, monthly: 0, restingUntil: odds.restUntil });
    else if (odds.best?.target === n && odds.monthly > 0) couldAttack.push({ nation: o, monthly: odds.monthly });
  }
  const when = (x: ThreatTie) => x.waitingUntil ?? x.restingUntil ?? Infinity;
  couldAttack.sort((a, b) => when(a) - when(b) || b.monthly - a.monthly || byName(a.nation, b.nation));

  return {
    overlord: me.overlord ? { nation: me.overlord, union: me.subjectType === 'union' } : undefined,
    allies: alliesOf(s, n).sort(byName),
    subjects,
    marriages,
    yourClaims,
    claimsOnYou,
    forging: me.fabricating ? { region: me.fabricating.region, holder: s.regions[me.fabricating.region]?.owner ?? null, done: me.fabricating.done } : undefined,
    accessYouHave,
    accessYouGive,
    truces,
    rivalsYouNamed,
    rivalsOfYou,
    oldFriends,
    oldFoes,
    couldAttack,
    coalitionAgainst: coalitionAgainst(s, n),
    coalitionIn: coalitionOf(s, n),
  };
}
