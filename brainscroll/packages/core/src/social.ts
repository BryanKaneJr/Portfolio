/**
 * Social (owner, 2026-10-01): friends, weekly leagues and a feed, before
 * launch. Mirrors backend/supabase/migrations/20261022000000_social.sql.
 *
 * - Leagues run Monday 00:00 UTC to Monday (as quests) with up to
 *   LEAGUE.SIZE learners, matched by brain (knowledge) level: within 20% of
 *   each other, and anyone under Level 100 is fair game. With no match, a
 *   learner joins a league still under LEAGUE.SAFETY_NET_SIZE (so nobody
 *   competes alone) before a new one starts. Weekly XP is every ledger event
 *   in the week except league prizes.
 * - When the week ends the top 3 earn LEAGUE.PRIZES (1,000 / 500 / 250: an
 *   owner exception to "nothing dwarfs a level"). Place k pays only in a
 *   league of more than k learners, and only with XP that week.
 * - The feed shows the last 14 days of moments from you, your friends and
 *   your league mates: trophies, chapters finished, streak milestones and
 *   league podiums. Reactions are Dr. Scroll poses; there are no comments or
 *   messages.
 */
import { MILESTONE_TROPHIES } from './trophies';
import type { XpEvent } from './completion';
import { usernameBlocked } from './usernameFilter';

export const LEAGUE = {
  /** Most learners in a league (app_settings.league_size). */
  SIZE: 20,
  /** A learner with no level match joins a league still under this size (app_settings.league_min_size). */
  SAFETY_NET_SIZE: 5,
  /** Brain levels in a league stay within this ratio of each other... */
  LEVEL_BAND: 1.2,
  /** ...unless everyone is under this level: then anyone is fair game. */
  OPEN_BELOW: 100,
  /** XP for 1st, 2nd and 3rd when a week ends (app_settings.league_prize_1..3). */
  PRIZES: [1000, 500, 250],
} as const;

/** Streak lengths that make a feed moment. Mirrors SQL streak_feed_milestones(). */
export const STREAK_FEED_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 750, 1000] as const;

/** The only reactions: Dr. Scroll poses (mirrors the feed_reactions check). */
export const FEED_REACTIONS = [
  { id: 'clapping', label: 'Applause' },
  { id: 'celebrate', label: 'Celebrate' },
  { id: 'thumbs-up', label: 'Nice one' },
  { id: 'surprised', label: 'Wow' },
  { id: 'mastery', label: 'Genius' },
] as const;
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

/** Whether a learner at `level` fits a league whose (matched) members are at `levels`. */
export function leagueFits(levels: readonly number[], level: number): boolean {
  const all = [...levels, level];
  const max = Math.max(...all);
  return max < LEAGUE.OPEN_BELOW || max <= LEAGUE.LEVEL_BAND * Math.min(...all);
}

/** XP for finishing at `place` (1-based) in a league of `size` with `xp` that week. */
export function leaguePrize(place: number, size: number, xp: number): number {
  return place <= LEAGUE.PRIZES.length && xp > 0 && size > place ? LEAGUE.PRIZES[place - 1]! : 0;
}

const LEAGUE_NAMES = ['Owl', 'Comet', 'Atlas', 'Sphinx', 'Nova', 'Falcon', 'Quill', 'Orbit', 'Lantern', 'Compass', 'Prism', 'Summit'] as const;
/** A league's display name ("Comet League"), from its id. */
export const leagueName = (id: number | string) => `${LEAGUE_NAMES[Number(String(id).replace(/\D/g, '') || 0) % LEAGUE_NAMES.length]} League`;

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
}

export interface SocialView {
  me: { id: string; username: string; inviteCode: string; avatar?: string };
  friends: SocialCard[];
  incoming: SocialCard[];
  outgoing: SocialCard[];
}

export interface LeagueView {
  leagueId: string;
  weekStart: string;
  endsAt: string;
  /** Ranked by this week's XP. */
  members: (SocialCard & { you: boolean; blocked: boolean })[];
  /** How the learner's last league week ended: their place, and the prize if any. */
  lastWeek?: { weekStart: string; place?: number; xp?: number };
}

export type FeedKind = 'trophy' | 'chapter' | 'streak' | 'league';
export interface FeedItem {
  owner: SocialCard & { you: boolean; friend: boolean };
  kind: FeedKind;
  key: string;
  at: string;
  data: { trophyId?: string; name?: string; skillId?: string; chapter?: number; days?: number; place?: number; xp?: number };
  reactions: Partial<Record<FeedReaction, number>>;
  mine?: FeedReaction;
}

export type Relation = 'you' | 'friend' | 'requested' | 'asked_you' | 'league';
export interface SocialProfile extends SocialCard {
  relation: Relation;
  totalXp: number;
  streak: { current: number; longest: number };
  trophies: { trophyId: string; earnedAt: string }[];
  /** skillId → level cleared. */
  skills: Record<string, number>;
}

export type SocialErrorCode = 'AVATAR_LOCKED' | 'AVATAR_NOT_FOUND' | 'USERNAME_INVALID' | 'USERNAME_NOT_ALLOWED' | 'USERNAME_TAKEN' | 'USER_NOT_FOUND' | 'INVITE_NOT_FOUND' | 'TOO_MANY_REQUESTS';
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
};

/** The place in a league prize's reason ("league week 2026-10-05: place 1"). */
export function placeFromReason(reason: string | null | undefined): number | undefined {
  const m = reason?.match(/place (\d+)/);
  return m ? Number(m[1]) : undefined;
}
