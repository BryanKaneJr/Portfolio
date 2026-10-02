import {
  avatarIdFor,
  avatarUnlocked,
  LEGENDARY_AVATARS,
  learningStreak,
  leaguePrize,
  leagueWeekEnd,
  leagueWeekStart,
  knowledgeLevel,
  milestoneTrophies,
  placeFromReason,
  SocialError,
  STREAK_FEED_MILESTONES,
  totalCleared,
  usernameBlocked,
  weeklyXp,
  type FeedItem,
  type FeedReaction,
  type LeagueView,
  type ProgressState,
  type SocialCard,
  type SocialProfile,
  type SocialView,
} from '@brainscroll/core';
import { skills, trophyCatalog } from '@/content';

/**
 * Social in the development harness (localBackend): the same screens, with
 * a simulated league of learners whose XP grows through the week, who accept
 * friend requests, earn trophies and react to yours. Your own row is real:
 * your weekly XP, trophies, chapters and streak come from your progress, and
 * a podium finish pays its prize into your ledger like the server's
 * finalize_leagues_of. Nothing here talks to a network.
 */
export interface LocalSocialState {
  username?: string;
  avatar?: string;
  inviteCode?: string;
  /** Friend and league push notifications (default on). */
  socialNotifications?: boolean;
  friends: string[];
  outgoing: string[];
  /** Simulated learners who asked you (one does, the first time you look). */
  incoming: string[];
  blocked: string[];
  /** `${ownerId}|${itemKey}` → your reaction. */
  reactions: Record<string, FeedReaction>;
  seeded?: boolean;
}
export const emptyLocalSocial = (): LocalSocialState => ({ friends: [], outgoing: [], incoming: [], blocked: [], reactions: {} });

const ADJ = ['curious', 'bright', 'clever', 'swift', 'bold', 'calm', 'keen', 'wise', 'sunny', 'lucky', 'brave', 'witty'];
const NOUN = ['owl', 'fox', 'otter', 'panda', 'falcon', 'koala', 'lynx', 'heron', 'badger', 'whale', 'comet', 'atlas'];
const NAMES = ['maya_reads', 'leo_learns', 'priya', 'sam_k', 'noor', 'jules_w', 'diego', 'ava_chen', 'kofi', 'hana_m', 'ezra', 'lucia'];
const SIM_COUNT = NAMES.length;
const DAY = 86_400_000;

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

interface Sim {
  id: string;
  username: string;
  inviteCode: string;
  /** Brain level offset from yours, so the league is a fair match. */
  levelOffset: number;
}
const SIMS: Sim[] = NAMES.map((username, i) => ({ id: `sim-${i + 1}`, username, inviteCode: `SIM${String(i + 1).padStart(5, '0')}`, levelOffset: (hash(username) % 9) - 4 }));
const simById = (id: string) => SIMS.find((s) => s.id === id);

function myLevel(state: ProgressState) {
  return knowledgeLevel(totalCleared(state));
}

/** A simulated learner's XP in a week: a weekly target, earned evenly as the week goes. */
function simWeeklyXp(sim: Sim, weekStart: string, now: Date): number {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const share = Math.min(1, Math.max(0, (now.getTime() - start) / (7 * DAY)));
  return Math.round((150 + (hash(`${sim.id}:${weekStart}`) % 1800)) * share);
}

/** A starter avatar: a tree's, picked at random (by id, so it's stable). Mirrors SQL random_starter_avatar. */
const starterAvatar = (id: string) => avatarIdFor(skills[hash(`${id}:avatar`) % skills.length]!.id);
/** Simulated learners wear a starter avatar each, like everyone. */
const simAvatar = (sim: Sim) => starterAvatar(sim.id);

function simCard(sim: Sim, state: ProgressState, now: Date): SocialCard {
  return { id: sim.id, username: sim.username, avatar: simAvatar(sim), knowledgeLevel: Math.max(1, myLevel(state) + sim.levelOffset), weeklyXp: simWeeklyXp(sim, leagueWeekStart(now), now) };
}

function myCard(userId: string, social: LocalSocialState, state: ProgressState, now: Date): SocialCard {
  return { id: userId, username: social.username ?? 'you', ...(social.avatar ? { avatar: social.avatar } : {}), knowledgeLevel: myLevel(state), weeklyXp: weeklyXp(state.xpEvents, leagueWeekStart(now)) };
}

/** A friendly generated username (curious_otter_4821), never one the filter refuses: some numbers read as words (8008). */
function generatedUsername(h: number): string {
  for (let n = h % 10000; ; n = (n + 1) % 10000) {
    const name = `${ADJ[h % ADJ.length]}_${NOUN[(h >>> 4) % NOUN.length]}_${String(n).padStart(4, '0')}`;
    if (!usernameBlocked(name)) return name;
  }
}

/** Gives you a username, invite code and starter avatar, and one simulated friend request, the first time. */
export function ensureIdentity(userId: string, social: LocalSocialState): LocalSocialState {
  if (social.seeded) return social.avatar ? social : { ...social, avatar: starterAvatar(userId) };
  const h = hash(userId);
  return {
    ...social,
    username: social.username ?? generatedUsername(h),
    inviteCode: social.inviteCode ?? (h.toString(36).toUpperCase() + 'XXXXXXXX').slice(0, 8),
    avatar: social.avatar ?? starterAvatar(userId),
    incoming: ['sim-3'],
    seeded: true,
  };
}

export function socialView(userId: string, social: LocalSocialState, state: ProgressState, now: Date): SocialView {
  const cards = (ids: string[]) => ids.flatMap((id) => (simById(id) ? [simCard(simById(id)!, state, now)] : []));
  return {
    me: { id: userId, username: social.username!, inviteCode: social.inviteCode!, ...(social.avatar ? { avatar: social.avatar } : {}), socialNotifications: social.socialNotifications !== false },
    friends: cards(social.friends).sort((a, b) => b.weeklyXp - a.weeklyXp),
    incoming: cards(social.incoming),
    outgoing: cards(social.outgoing),
  };
}

/** The simulated league: you and every simulated learner, ranked by this week's XP. */
export function leagueView(userId: string, social: LocalSocialState, state: ProgressState, now: Date): LeagueView {
  const weekStart = leagueWeekStart(now);
  const members = [
    { ...myCard(userId, social, state, now), you: true, blocked: false },
    ...SIMS.map((s) => ({ ...simCard(s, state, now), you: false, blocked: social.blocked.includes(s.id) })),
  ].sort((a, b) => b.weeklyXp - a.weeklyXp || (a.you ? -1 : b.you ? 1 : a.id.localeCompare(b.id)));
  const last = state.xpEvents.filter((e) => e.type === 'LEAGUE_FINISH').at(-1);
  const lastWeekStart = leagueWeekStart(new Date(Date.parse(`${weekStart}T00:00:00Z`) - DAY));
  const played = Date.parse(state.createdAt) < Date.parse(`${weekStart}T00:00:00Z`);
  return {
    leagueId: String(Math.floor(Date.parse(`${weekStart}T00:00:00Z`) / (7 * DAY))),
    weekStart,
    endsAt: leagueWeekEnd(weekStart).toISOString(),
    members,
    ...(played
      ? { lastWeek: { weekStart: lastWeekStart, ...(last && last.idempotencyKey === `league_finish:${lastWeekStart}` ? { place: placeFromReason(last.reason), xp: last.amount } : {}) } }
      : {}),
  };
}

/** Pays last week's podium into your ledger, once (as the server's finalize_leagues_of). */
export function payLastWeek(state: ProgressState, now: Date): ProgressState {
  const weekStart = leagueWeekStart(now);
  const lastWeekStart = leagueWeekStart(new Date(Date.parse(`${weekStart}T00:00:00Z`) - DAY));
  const key = `league_finish:${lastWeekStart}`;
  if (Date.parse(state.createdAt) >= Date.parse(`${weekStart}T00:00:00Z`) || state.xpEvents.some((e) => e.idempotencyKey === key)) return state;
  const mine = weeklyXp(state.xpEvents, lastWeekStart);
  const end = leagueWeekEnd(lastWeekStart);
  const place = 1 + SIMS.filter((s) => simWeeklyXp(s, lastWeekStart, end) > mine).length;
  const amount = leaguePrize(place, SIMS.length + 1, mine);
  if (!amount) return state;
  return { ...state, xpEvents: [...state.xpEvents, { type: 'LEAGUE_FINISH', amount, reason: `league week ${lastWeekStart}: place ${place}`, idempotencyKey: key, at: now.toISOString() }] };
}

/** Your own moments in the last 14 days, from your real progress. */
function myMoments(userId: string, social: LocalSocialState, state: ProgressState, now: Date): Omit<FeedItem, 'reactions' | 'mine'>[] {
  const since = now.getTime() - 14 * DAY;
  const owner = { ...myCard(userId, social, state, now), you: true, friend: false };
  const items: Omit<FeedItem, 'reactions' | 'mine'>[] = [];
  for (const t of milestoneTrophies(state, trophyCatalog)) if (Date.parse(t.earnedAt) >= since) items.push({ owner, kind: 'trophy', key: `trophy:${t.trophyId}`, at: t.earnedAt, data: { trophyId: t.trophyId } });
  for (const [levelId, l] of Object.entries(state.levels)) {
    const number = Number(levelId.split('.').at(-1));
    if (number % 10 === 0 && Date.parse(l.completedAt) >= since) items.push({ owner, kind: 'chapter', key: `chapter:${levelId}`, at: l.completedAt, data: { skillId: levelId.replace(/^level\./, 'skill.').replace(/\.\d+$/, ''), chapter: number / 10 } });
  }
  // Streak milestones: the day each run reached 3, 7, 14 ... days.
  const days = Object.entries(state.learningDays ?? {}).sort(([a], [b]) => a.localeCompare(b));
  let run = 0;
  days.forEach(([day, at], i) => {
    run = i > 0 && Date.parse(day) - Date.parse(days[i - 1]![0]) === DAY ? run + 1 : 1;
    if ((STREAK_FEED_MILESTONES as readonly number[]).includes(run) && Date.parse(at) >= since) items.push({ owner, kind: 'streak', key: `streak:${run}:${day}`, at, data: { days: run } });
  });
  for (const e of state.xpEvents) if (e.type === 'LEAGUE_FINISH' && Date.parse(e.at) >= since) items.push({ owner, kind: 'league', key: `league:${e.idempotencyKey}`, at: e.at, data: { place: placeFromReason(e.reason), xp: e.amount } });
  return items;
}

const SIM_TROPHIES = ['trophy.chapter_one', 'trophy.warming_up', 'trophy.curious', 'trophy.streak_7', 'trophy.perfect_10', 'trophy.well_rounded', 'trophy.century', 'trophy.halfway', 'trophy.ten_chapters', 'trophy.streak_30'];

/** A simulated learner's moments: about one every other day. */
function simMoments(sim: Sim, social: LocalSocialState, state: ProgressState, now: Date): Omit<FeedItem, 'reactions' | 'mine'>[] {
  const owner = { ...simCard(sim, state, now), you: false, friend: social.friends.includes(sim.id) };
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const items: Omit<FeedItem, 'reactions' | 'mine'>[] = [];
  for (let d = 0; d < 14; d++) {
    const day = new Date(today - d * DAY).toISOString().slice(0, 10);
    const h = hash(`${sim.id}:${day}`);
    if (h % 2) continue;
    const at = new Date(today - d * DAY + (h % 20) * 3_600_000 + 3_600_000);
    if (at > now) continue;
    const kind = (['chapter', 'streak', 'trophy', 'chapter'] as const)[(h >>> 3) % 4];
    if (kind === 'chapter') {
      const skill = skills[(h >>> 5) % skills.length]!;
      const chapter = 1 + ((h >>> 9) % 6);
      items.push({ owner, kind, key: `chapter:${skill.id}:${chapter}`, at: at.toISOString(), data: { skillId: skill.id, chapter } });
    } else if (kind === 'streak') {
      const days = STREAK_FEED_MILESTONES[(h >>> 5) % 6]!;
      items.push({ owner, kind, key: `streak:${days}:${day}`, at: at.toISOString(), data: { days } });
    } else {
      const trophyId = SIM_TROPHIES[(h >>> 5) % SIM_TROPHIES.length]!;
      items.push({ owner, kind, key: `trophy:${trophyId}`, at: at.toISOString(), data: { trophyId } });
    }
  }
  return items;
}

export function feedView(userId: string, social: LocalSocialState, state: ProgressState, now: Date): FeedItem[] {
  const visible = SIMS.filter((s) => !social.blocked.includes(s.id));
  const items = [...myMoments(userId, social, state, now), ...visible.flatMap((s) => simMoments(s, social, state, now))];
  const seen = new Set<string>();
  return items
    .filter((i) => !seen.has(`${i.owner.id}|${i.key}`) && seen.add(`${i.owner.id}|${i.key}`))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 60)
    .map((i) => {
      // Simulated learners react too, so your moments don't sit unanswered.
      const h = hash(`${i.owner.id}|${i.key}`);
      const reactions: FeedItem['reactions'] = {};
      if (h % 3 !== 0) reactions[(['clapping', 'celebrate', 'thumbs-up', 'surprised', 'mastery'] as const)[h % 5]] = 1 + (h % 4);
      const mine = social.reactions[`${i.owner.id}|${i.key}`];
      if (mine) reactions[mine] = (reactions[mine] ?? 0) + 1;
      return { ...i, reactions, ...(mine ? { mine } : {}) };
    });
}

export function profileView(userId: string, targetId: string, social: LocalSocialState, state: ProgressState, now: Date): SocialProfile {
  if (targetId === userId) {
    return {
      ...myCard(userId, social, state, now),
      relation: 'you',
      totalXp: state.xpEvents.reduce((n, e) => n + e.amount, 0),
      streak: learningStreak(state, now),
      trophies: milestoneTrophies(state, trophyCatalog).map((t) => ({ trophyId: t.trophyId, earnedAt: t.earnedAt })),
      skills: Object.fromEntries(Object.entries(state.skills).filter(([, s]) => s.highestCleared > 0).map(([id, s]) => [id, s.highestCleared])),
    };
  }
  const sim = simById(targetId);
  if (!sim || social.blocked.includes(sim.id)) throw new SocialError('USER_NOT_FOUND');
  const h = hash(sim.id);
  const card = simCard(sim, state, now);
  const picked = [0, 1, 2, 3].map((k) => skills[(h >>> (k * 3)) % skills.length]!.id);
  return {
    ...card,
    relation: social.friends.includes(sim.id) ? 'friend' : social.outgoing.includes(sim.id) ? 'requested' : social.incoming.includes(sim.id) ? 'asked_you' : 'league',
    totalXp: 2_000 + (h % 20_000),
    streak: { current: 1 + (h % 30), longest: 10 + (h % 60) },
    trophies: SIM_TROPHIES.filter((_, k) => (h >>> k) % 2).map((trophyId, k) => ({ trophyId, earnedAt: new Date(now.getTime() - (k + 1) * 3 * DAY).toISOString() })),
    skills: Object.fromEntries(picked.map((id, k) => [id, 1 + ((h >>> (k * 5)) % (card.knowledgeLevel * 3))])),
  };
}

export function findSim(username: string, social: LocalSocialState, state: ProgressState, now: Date): SocialCard | null {
  const sim = SIMS.find((s) => s.username === username.trim().toLowerCase());
  return sim && !social.blocked.includes(sim.id) ? simCard(sim, state, now) : null;
}

export function inviteSim(code: string, social: LocalSocialState, state: ProgressState, now: Date): { social: LocalSocialState; card: SocialCard } {
  const sim = SIMS.find((s) => s.inviteCode === code.trim().toUpperCase());
  if (!sim || social.blocked.includes(sim.id)) throw new SocialError('INVITE_NOT_FOUND');
  return { social: befriend(social, sim.id), card: simCard(sim, state, now) };
}

export function befriend(social: LocalSocialState, id: string): LocalSocialState {
  return {
    ...social,
    friends: [...new Set([...social.friends, id])],
    outgoing: social.outgoing.filter((x) => x !== id),
    incoming: social.incoming.filter((x) => x !== id),
  };
}

/** Mirrors SQL set_avatar: any tree's avatar; gold needs the tree at Level 100; legendary needs its trophy. */
export function checkAvatar(avatar: string, state: ProgressState): string {
  const levels = Object.fromEntries(Object.entries(state.skills).map(([id, s]) => [id, s.highestCleared]));
  const ids = skills.map((s) => s.id);
  const earned = milestoneTrophies(state, trophyCatalog).map((t) => t.trophyId);
  const known = avatar in LEGENDARY_AVATARS || avatarUnlocked(avatar.replace(/\.gold$/, ''), levels, ids);
  if (!known) throw new SocialError('AVATAR_NOT_FOUND');
  if (!avatarUnlocked(avatar, levels, ids, earned)) throw new SocialError('AVATAR_LOCKED');
  return avatar;
}

export function checkUsername(name: string): string {
  const v = name.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(v)) throw new SocialError('USERNAME_INVALID');
  // Mirrors SQL set_username: the same filter (core usernameFilter) as the server.
  if (usernameBlocked(v)) throw new SocialError('USERNAME_NOT_ALLOWED');
  if (NAMES.includes(v)) throw new SocialError('USERNAME_TAKEN');
  return v;
}

export const SIM_COUNT_FOR_TESTS = SIM_COUNT;
