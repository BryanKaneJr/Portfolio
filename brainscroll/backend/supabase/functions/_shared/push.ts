// Social push notifications: the words, and the messages sent to Expo.
// Pure, so scripts/test/push.test.ts checks them (including that nothing reads
// as guilt, a threat or a fake deadline). The database decides what goes out and
// when (claim_social_pushes in 20261028000000_social_push.sql).

export type PushKind = 'friend_request' | 'friend_new' | 'passed' | 'league_result' | 'reaction';
export interface PushGroup {
  user_id: string;
  kind: PushKind;
  tokens: string[];
  /** Newest first. */
  items: Record<string, unknown>[];
}
export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  /** Where a tap opens the app (an Expo Router path). */
  data: { url: string };
  channelId: 'social';
}

/** Mirrors core LEAGUE_TIERS / tierName / theTier (social.ts); a test keeps them equal. */
export const LEAGUE_TIERS = ['Scribblers', 'Bookworms', 'Apprentices', 'Scholars', 'Sages', 'Professors', 'Luminaries', 'Dr. Scroll’s Circle'] as const;
export const tierName = (tier: number) => LEAGUE_TIERS[Math.min(LEAGUE_TIERS.length, Math.max(1, Math.round(tier))) - 1]!;
export const theTier = (tier: number) => (tierName(tier).startsWith('Dr.') ? tierName(tier) : `the ${tierName(tier)}`);

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}

const at = (v: unknown) => `@${String(v ?? 'someone')}`;
const num = (v: unknown) => Number(v ?? 0);
const xp = (n: number) => `${n.toLocaleString('en-US')} XP`;

/** "@ana", "@ana and @ben", "@ana and 2 others": distinct names, newest first. */
function people(items: Record<string, unknown>[]): string {
  const names = [...new Set(items.map((i) => String(i.username ?? 'someone')))];
  if (names.length === 1) return at(names[0]);
  if (names.length === 2) return `${at(names[0])} and ${at(names[1])}`;
  return `${at(names[0])} and ${names.length - 1} others`;
}

/** The note for one group (one kind, one learner). */
export function renderPush(kind: PushKind, items: Record<string, unknown>[]): { title: string; body: string; url: string } | null {
  const first = items[0];
  if (!first) return null;
  switch (kind) {
    case 'friend_request':
      return items.length === 1
        ? { title: 'New friend request', body: `${at(first.username)} wants to be friends on BrainScroll.`, url: '/social' }
        : { title: 'New friend requests', body: `${people(items)} want to be friends on BrainScroll.`, url: '/social' };
    case 'friend_new':
      return items.length === 1
        ? { title: 'New friend', body: `You and ${at(first.username)} are friends now. See how you compare!`, url: `/person/${String(first.user_id ?? '')}` }
        : { title: 'New friends', body: `You're now friends with ${people(items)}. See how you compare!`, url: '/social' };
    case 'passed': {
      const gap = num(first.gap);
      const back = gap <= 100 ? 'One level could put you back in front.' : 'A couple of levels could put you back in front.';
      return { title: tierName(num(first.tier) || 1), body: `${at(first.username)} just passed you by ${xp(gap)}. ${back}`, url: '/league' };
    }
    case 'league_result': {
      const place = num(first.place);
      const prize = num(first.prize);
      const moved = num(first.moved);
      const tier = num(first.tier) || 1;
      const finish = prize > 0 ? `You finished ${ordinal(place)} and won ${xp(prize)}!` : `You finished ${ordinal(place)} of ${num(first.of)}.`;
      // Moving up is the headline; moving down is said plainly, never as a loss.
      if (moved > 0) return { title: `Welcome to ${theTier(tier)}!`, body: `${finish} You moved up a league.`, url: '/league' };
      return {
        title: 'Your league week is over',
        body: `${finish} ${moved < 0 ? `This week you’re with ${theTier(tier)}.` : 'A new league starts now.'}`,
        url: '/league',
      };
    }
    case 'reaction':
      return { title: 'New hearts', body: `${people(items)} liked your moment${items.length > 1 ? 's' : ''} in the feed.`, url: '/social' };
    default:
      return null;
  }
}

/** One Expo message per device for each group that renders. */
export function expoMessages(groups: PushGroup[]): ExpoMessage[] {
  const out: ExpoMessage[] = [];
  for (const g of groups) {
    const note = renderPush(g.kind, g.items);
    if (!note) continue;
    for (const to of g.tokens) out.push({ to, title: note.title, body: note.body, sound: 'default', data: { url: note.url }, channelId: 'social' });
  }
  return out;
}

/** Expo accepts up to 100 messages per request. */
export function chunk<T>(list: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Tokens Expo says are gone (the app was removed), from a send response's tickets. */
export function goneTokens(messages: ExpoMessage[], tickets: { status: string; details?: { error?: string } }[]): string[] {
  return tickets.flatMap((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i] ? [messages[i].to] : []));
}

/** The cron call carries a shared secret, like the RevenueCat webhook. */
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const want = `Bearer ${secret}`;
  if (header.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= header.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}
