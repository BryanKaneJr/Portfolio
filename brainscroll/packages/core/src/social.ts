/**
 * Social (owner, 2026-10-01): friends, weekly leagues and a feed, before
 * launch. Mirrors backend/supabase/migrations/20261022000000_social.sql.
 *
 * - Leagues run Monday 00:00 UTC to Monday (as quests) with up to
 *   LEAGUE.SIZE learners in the same tier (LEAGUE_TIERS, owner 2026-10-08:
 *   Quartz up through the gems to Crown; everyone starts in Quartz).
 *   With no league in their tier to join, a learner joins any league still
 *   under LEAGUE.SAFETY_NET_SIZE, nearest tier first (so nobody competes
 *   alone), before a new one starts. Weekly XP is every ledger event in the
 *   week except league prizes.
 * - When the week ends the top 3 earn LEAGUE.PRIZES (1,000 / 500 / 250: an
 *   owner exception to "nothing dwarfs a level"). Place k pays only in a
 *   league of more than k learners, and only with XP that week. Learners
 *   then move up or down a tier (`leagueMove`): the top 5 up and the bottom
 *   3 down; a league under 10 moves its top 3 up and nobody down
 *   (migration 20261108000000_league_tiers.sql).
 * - The feed shows the last 14 days of moments from you, your friends and
 *   your league mates: trophies, chapters finished, streak milestones and
 *   league podiums. The only reaction is a heart; there are no comments or
 *   messages.
 * - Profiles are public unless the learner turns on Private profile; a
 *   private one opens only to friends and league mates, and anyone else sees
 *   the username and avatar (`profileAccess`); a blocked learner
 *   is a hidden row in the league (`hiddenLeagueMember`). Fixes from QA,
 *   2026-10-03: migration 20261103000000_social_qa_fixes.sql.
 */
import { MILESTONE_TROPHIES } from './trophies';
import type { XpEvent } from './completion';
import { usernameBlocked } from './usernameFilter';

export const LEAGUE = {
  /** Most learners in a league (app_settings.league_size). */
  SIZE: 20,
  /** A learner with no league in their tier joins one still under this size (app_settings.league_min_size). */
  SAFETY_NET_SIZE: 5,
  /** XP for 1st, 2nd and 3rd when a week ends (app_settings.league_prize_1..3). */
  PRIZES: [1000, 500, 250],
  /** When a week ends, this many at the top move up a tier (app_settings.league_promote)... */
  PROMOTE: 5,
  /** ...and this many at the bottom move down (app_settings.league_demote)... */
  DEMOTE: 3,
  /** ...in a league of at least this many (app_settings.league_small_size). */
  SMALL_LEAGUE: 10,
  /** A smaller league moves only its top few up, and nobody down (app_settings.league_promote_small). */
  PROMOTE_SMALL: 3,
} as const;

/**
 * League tiers, bottom to top (owner, 2026-10-08: tiers you move up and down
 * each week; seven gems "and then crown as the top", each easy to draw as an
 * icon). A learner's tier is a number from 1. Mirrors the check on SQL
 * profiles.league_tier.
 */
export const LEAGUE_TIERS = ['Quartz', 'Amethyst', 'Aquamarine', 'Sapphire', 'Emerald', 'Ruby', 'Diamond', 'Crown'] as const;
/** A tier's gem (or the Crown), for tier 1 to LEAGUE_TIERS.length. */
export const tierGem = (tier: number) => LEAGUE_TIERS[Math.min(LEAGUE_TIERS.length, Math.max(1, Math.round(tier))) - 1]!;
/** A tier's league: "Sapphire League". */
export const tierName = (tier: number) => `${tierGem(tier)} League`;
/** In a sentence: "the Sapphire League". */
export const theTier = (tier: number) => `the ${tierName(tier)}`;

/**
 * Where finishing at `place` (1-based) in a league of `size` with `xp` that
 * week moves a learner: up a tier (1), down (-1) or nowhere (0). Moving up
 * takes XP that week and someone behind you, as a prize does. Mirrors SQL
 * league_move; the tier itself stops at the top and bottom (`movedTier`).
 */
export function leagueMove(place: number, size: number, xp: number): -1 | 0 | 1 {
  if (size < LEAGUE.SMALL_LEAGUE) return place <= LEAGUE.PROMOTE_SMALL && size > place && xp > 0 ? 1 : 0;
  if (place <= LEAGUE.PROMOTE) return xp > 0 ? 1 : 0;
  return place > size - LEAGUE.DEMOTE ? -1 : 0;
}
/** The tier a move lands in, never past the first or the last. */
export const movedTier = (tier: number, move: number) => Math.min(LEAGUE_TIERS.length, Math.max(1, tier + move));

/** Streak lengths that make a feed moment. Mirrors SQL streak_feed_milestones(). */
export const STREAK_FEED_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 750, 1000] as const;

/** The one reaction: a heart (owner, 2026-10-03: "cleaner, like every other app"). Mirrors the feed_reactions check. */
export const FEED_REACTIONS = [{ id: 'heart', label: 'Like' }] as const;
export type FeedReaction = (typeof FEED_REACTIONS)[number]['id'];

/** The Monday (UTC) a league week starts on, as YYYY-MM-DD. Mirrors SQL league_week_start. */
export function leagueWeekStart(at: Date): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** When the league week that starts on `weekStart` ends. */
export const leagueWeekEnd = (weekStart: string) => new Date(Date.parse(`${weekStart}T00:00:00Z`) + 7 * 86_400_000);

/** XP earned in a league week: every event in it except league prizes. Mirrors SQL weekly_xp. */
export function weeklyXp(events: readonly XpEvent[], weekStart: string): number {
  const from = Date.parse(`${weekStart}T00:00:00Z`);
  const to = leagueWeekEnd(weekStart).getTime();
  return events.filter((e) => e.type !== 'LEAGUE_FINISH' && Date.parse(e.at) >= from && Date.parse(e.at) < to).reduce((n, e) => n + e.amount, 0);
}

/** XP for finishing at `place` (1-based) in a league of `size` with `xp` that week. */
export function leaguePrize(place: number, size: number, xp: number): number {
  return place <= LEAGUE.PRIZES.length && xp > 0 && size > place ? LEAGUE.PRIZES[place - 1]! : 0;
}


/** Social's world leaderboard (owner, 2026-10-09): ten rows, the first three places always among them. */
export const WORLD_BOARD = { ROWS: 10, TOP: 3 } as const;

/**
 * Which places this week's world leaderboard shows, in order. Everyone with XP
 * this week has a place (1 = the most XP); `mine` is yours (one after the last
 * place when you have none yet), and `friendPlaces` your friends'. Ten rows at
 * most: the top 3 and you, then the friends nearest your place, then the
 * places nearest yours (above first). Mirrors SQL world_board_places.
 */
export function worldBoardPlaces(total: number, mine: number, friendPlaces: readonly number[]): number[] {
  const shown = new Set<number>();
  const add = (p: number) => {
    if (shown.size < WORLD_BOARD.ROWS && p >= 1 && p <= total) shown.add(p);
  };
  for (let p = 1; p <= WORLD_BOARD.TOP; p++) add(p);
  add(mine);
  [...friendPlaces].sort((a, b) => Math.abs(a - mine) - Math.abs(b - mine) || a - b).forEach(add);
  for (let d = 1; d < total && shown.size < WORLD_BOARD.ROWS; d++) {
    add(mine - d);
    add(mine + d);
  }
  return [...shown].sort((a, b) => a - b);
}

/** "1st", "2nd", "3rd", "4th"... */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}

/** Username rules (mirrors SQL set_username): 3 to 20 of a-z, 0-9 and _. Returns why not, or null. */
export function usernameProblem(name: string): string | null {
  const v = name.trim().toLowerCase();
  if (v.length < 3) return 'At least 3 characters.';
  if (v.length > 20) return 'At most 20 characters.';
  if (!/^[a-z0-9_]+$/.test(v)) return 'Letters, numbers and _ only.';
  if (usernameBlocked(v)) return 'That username isn’t allowed. Try another.';
  return null;
}

/**
 * How rare a trophy is, for "rarest trophies" on a profile: higher is rarer.
 * By what it takes, not by live counts: everything mastered, then subjects,
 * whole-catalog trophies and skill masteries, then series by how far up they go.
 */
export function trophyRarity(trophyId: string): number {
  if (trophyId === 'trophy.master_of_all') return 100_000;
  if (trophyId.startsWith('trophy.subject_')) return 90_000;
  if (trophyId === 'trophy.jack_of_all_trades') return 85_000;
  if (trophyId.startsWith('trophy.mastery_')) return 80_000;
  const m = MILESTONE_TROPHIES.find((t) => t.id === trophyId);
  // Not in the fixed list: a weekly quest's own trophy, earned only in its live week.
  if (!m) return 3_000;
  const count = 'count' in m ? m.count : 1;
  const weight: Record<string, number> = { streak: 40, 'streak-gold': 40, 'quest-clears': 300, 'quest-clears-gold': 300, chapters: 100, 'chapters-gold': 100, 'perfect-lessons': 12, 'perfect-lessons-gold': 12, reviews: 6, 'reviews-gold': 6, levels: 4, 'levels-gold': 4 };
  const fixed: Record<string, number> = { 'trophy.mastered': 70_000, 'trophy.explorer': 9_000, 'trophy.polymath': 5_000, 'trophy.halfway': 4_000, 'trophy.well_rounded': 2_500, 'trophy.curious': 1_500 };
  return fixed[m.id] ?? count * (weight[m.art] ?? 10);
}

/** A learner's rarest `n` trophies, rarest first (ties: the earlier earned). */
export function rarestTrophies<T extends { trophyId: string; earnedAt?: string }>(trophies: readonly T[], n = 3): T[] {
  return [...trophies].sort((a, b) => trophyRarity(b.trophyId) - trophyRarity(a.trophyId) || (a.earnedAt ?? '').localeCompare(b.earnedAt ?? '')).slice(0, n);
}

/**
 * Two learners' subjects side by side: the levels cleared in each subject
 * (a subject's level, as on the World Map), for "what you're better in".
 */
export function compareSubjects(
  mine: Readonly<Record<string, number>>,
  theirs: Readonly<Record<string, number>>,
  skills: readonly { id: string; subjectId: string }[],
  subjects: readonly { id: string; name: string }[],
): { subjectId: string; name: string; you: number; them: number }[] {
  const total = (levels: Readonly<Record<string, number>>, subjectId: string) =>
    skills.filter((s) => s.subjectId === subjectId).reduce((n, s) => n + (levels[s.id] ?? 0), 0);
  return subjects.map((s) => ({ subjectId: s.id, name: s.name, you: total(mine, s.id), them: total(theirs, s.id) }));
}

// ─── What the app shows (both backends return these) ─────────────────────────

// ─── Avatars (owner, 2026-10-01) ─────────────────────────────────────────────

/**
 * A profile avatar: every tree's (`avatar.<skill slug>`) is unlocked from the
 * start; its gold one (`avatar.<skill slug>.gold`) unlocks at Level 100 of
 * that tree. Mirrors SQL set_avatar. No avatar shows the username's initial.
 */
export const avatarIdFor = (skillId: string, gold = false) => `avatar.${skillId.split('.').at(-1)}${gold ? '.gold' : ''}`;

/** The skill an avatar belongs to, and whether it's the gold one; undefined for an unknown id. */
export function parseAvatarId(id: string, skillIds: readonly string[]): { skillId: string; gold: boolean } | undefined {
  const m = id.match(/^avatar\.([a-z_]+)(\.gold)?$/);
  const skillId = m ? skillIds.find((s) => s.split('.').at(-1) === m[1]) : undefined;
  return skillId ? { skillId, gold: !!m![2] } : undefined;
}

/**
 * Legendary avatars (owner art, 2026-10-01; docs/images-avatars-legendary.md):
 * one per top gold trophy, worn only by those who earned it. Master of All is
 * a golden Dr. Scroll, the one avatar he appears in. Mirrors SQL
 * legendary_avatar_trophy.
 */
export const LEGENDARY_AVATARS = {
  'avatar.legendary.master_of_all': 'trophy.master_of_all',
  'avatar.legendary.jack_of_all_trades': 'trophy.jack_of_all_trades',
  'avatar.legendary.master_history': 'trophy.subject_history',
  'avatar.legendary.master_science': 'trophy.subject_science',
  'avatar.legendary.master_geography': 'trophy.subject_geography',
  'avatar.legendary.master_arts': 'trophy.subject_arts',
  'avatar.legendary.master_world_systems': 'trophy.subject_world_systems',
  'avatar.legendary.master_mind': 'trophy.subject_mind',
  'avatar.legendary.thousand_levels': 'trophy.thousand',
  'avatar.legendary.fifty_chapters': 'trophy.fifty_chapters',
  'avatar.legendary.perfect_thousand': 'trophy.perfect_1000',
  'avatar.legendary.steel_trap': 'trophy.steel_trap',
  'avatar.legendary.quest_legend': 'trophy.quests_52',
  'avatar.legendary.streak_thousand': 'trophy.streak_1000',
} as const satisfies Record<string, string>;
export type LegendaryAvatarId = keyof typeof LEGENDARY_AVATARS;

/**
 * Whether a learner may wear an avatar: any tree's; its gold one at Level 100
 * of that tree; a legendary one with its trophy earned.
 */
export function avatarUnlocked(id: string, skillLevels: Readonly<Record<string, number>>, skillIds: readonly string[], earnedTrophyIds: readonly string[] = []): boolean {
  if (id in LEGENDARY_AVATARS) return earnedTrophyIds.includes(LEGENDARY_AVATARS[id as LegendaryAvatarId]);
  const a = parseAvatarId(id, skillIds);
  return !!a && (!a.gold || (skillLevels[a.skillId] ?? 0) >= AVATAR_GOLD_LEVEL);
}
/** The level of a tree that unlocks its gold avatar: mastery. */
export const AVATAR_GOLD_LEVEL = 100;

/** A learner as friends and league mates see them in lists. */
export interface SocialCard {
  id: string;
  username: string;
  /** Their chosen avatar id, if any. */
  avatar?: string;
  knowledgeLevel: number;
  weeklyXp: number;
  /** What they wear (rewards.ts): a ring id, a name style id, and their title's name. */
  ring?: string | null;
  nameStyle?: string | null;
  title?: string | null;
  /** Their league tier (LEAGUE_TIERS, from 1). */
  leagueTier?: number;
}

export interface SocialView {
  /** socialNotifications: friend and league push notifications are on (default on; the server sends them). privateProfile: only friends and league mates see your profile (default off). */
  me: { id: string; username: string; inviteCode: string; avatar?: string; socialNotifications: boolean; privateProfile: boolean; leagueTier: number };
  friends: SocialCard[];
  incoming: SocialCard[];
  outgoing: SocialCard[];
}

/** One row of this week's world leaderboard: a place, and who holds it. */
export type WorldBoardRow = SocialCard & {
  place: number;
  you: boolean;
  friend: boolean;
  /** Blocked either way, or a private profile outside your friends and league: a place and XP, no name. */
  hidden: boolean;
};

export interface WorldBoardView {
  weekStart: string;
  /** How many learners have XP this week. */
  ranked: number;
  /** In place order; places can skip (a gap between rows). */
  rows: WorldBoardRow[];
}

export interface LeagueView {
  leagueId: string;
  /** The learner's tier this week: the league is named after it. */
  tier: number;
  weekStart: string;
  endsAt: string;
  /** Ranked by this week's XP. */
  members: (SocialCard & { you: boolean; blocked: boolean })[];
  /** How the learner's last league week ended: their place, the prize if any, and the tier it moved them to. */
  lastWeek?: { weekStart: string; place?: number; xp?: number; moved?: -1 | 0 | 1; tier?: number };
}

export type FeedKind = 'trophy' | 'chapter' | 'streak' | 'league' | 'tier';
export interface FeedItem {
  owner: SocialCard & { you: boolean; friend: boolean };
  kind: FeedKind;
  key: string;
  at: string;
  data: { trophyId?: string; name?: string; skillId?: string; chapter?: number; days?: number; place?: number; xp?: number; tier?: number };
  reactions: Partial<Record<FeedReaction, number>>;
  mine?: FeedReaction;
}

export type Relation = 'you' | 'friend' | 'requested' | 'asked_you' | 'league' | 'none';
export interface SocialProfile extends SocialCard {
  relation: Relation;
  /**
   * A private profile and you're not a friend or league mate: only the
   * username and avatar are shared, and every number below is empty.
   */
  limited: boolean;
  totalXp: number;
  streak: { current: number; longest: number };
  trophies: { trophyId: string; earnedAt: string }[];
  /** skillId → level cleared. */
  skills: Record<string, number>;
}

/**
 * Who may see a learner's profile, and how much (mirrors SQL get_social_profile):
 * a public profile is open to everyone; a private one (owner, 2026-10-03: a
 * Settings switch) to yourself, friends and current league mates, and anyone
 * else sees only the username and avatar. Blocked either way: nothing (null:
 * "not found").
 */
export function profileAccess(a: { self: boolean; friend: boolean; leagueMate: boolean; requested: boolean; askedYou: boolean; blocked: boolean; private: boolean }): { relation: Relation; limited: boolean } | null {
  if (a.self) return { relation: 'you', limited: false };
  if (a.blocked) return null;
  const open = !a.private || a.friend || a.leagueMate;
  const relation: Relation = a.friend ? 'friend' : a.requested ? 'requested' : a.askedYou ? 'asked_you' : a.leagueMate ? 'league' : 'none';
  return { relation, limited: !open };
}

/**
 * A league row for someone blocked either way (mirrors SQL get_league): their
 * place and weekly XP still count, but nothing says who they are.
 */
export function hiddenLeagueMember(index: number, weeklyXp: number): LeagueView['members'][number] {
  return { id: `hidden-${index}`, username: '', knowledgeLevel: 0, weeklyXp, you: false, blocked: true };
}

/** What a learner can report someone for (user_reports.reason), and an optional note of at most this many characters. */
export const USER_REPORT_REASONS = [
  { id: 'username', label: 'Their username' },
  { id: 'cheating', label: 'Cheating' },
  { id: 'other', label: 'Something else' },
] as const;
export type UserReportReason = (typeof USER_REPORT_REASONS)[number]['id'];
export const USER_REPORT_NOTE_MAX = 500;

/** Someone you've blocked, as Settings lists them to unblock. */
export interface BlockedLearner {
  id: string;
  username: string;
  avatar?: string;
}

export type SocialErrorCode = 'AVATAR_LOCKED' | 'AVATAR_NOT_FOUND' | 'USERNAME_INVALID' | 'USERNAME_NOT_ALLOWED' | 'USERNAME_TAKEN' | 'USER_NOT_FOUND' | 'INVITE_NOT_FOUND' | 'TOO_MANY_REQUESTS' | 'MOMENT_NOT_FOUND';
export class SocialError extends Error {
  constructor(public readonly code: SocialErrorCode) {
    super(code);
    this.name = 'SocialError';
  }
}

/** What to say for a social error. */
export const SOCIAL_ERROR_TEXT: Record<SocialErrorCode, string> = {
  AVATAR_LOCKED: 'Master that tree to wear its gold avatar.',
  AVATAR_NOT_FOUND: 'That avatar isn’t available.',
  USERNAME_INVALID: 'Use 3 to 20 letters, numbers or _.',
  USERNAME_NOT_ALLOWED: 'That username isn’t allowed. Try another.',
  USERNAME_TAKEN: 'That username is taken. Try another.',
  USER_NOT_FOUND: 'No one by that username.',
  INVITE_NOT_FOUND: 'That invite link didn’t work. Ask for a new one.',
  TOO_MANY_REQUESTS: 'That’s a lot at once. Try again later.',
  MOMENT_NOT_FOUND: 'That moment isn’t there any more.',
};

/** The place in a league prize's reason ("league week 2026-10-05: place 1"). */
export function placeFromReason(reason: string | null | undefined): number | undefined {
  const m = reason?.match(/place (\d+)/);
  return m ? Number(m[1]) : undefined;
}
