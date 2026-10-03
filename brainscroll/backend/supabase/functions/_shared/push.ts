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

/** Mirrors core LEAGUE_NAMES / leagueName (social.ts); a test keeps them equal. */
export const LEAGUE_NAMES = ['Owl', 'Comet', 'Atlas', 'Sphinx', 'Nova', 'Falcon', 'Quill', 'Orbit', 'Lantern', 'Compass', 'Prism', 'Summit'] as const;
export const leagueName = (id: number | string) => `${LEAGUE_NAMES[Number(String(id).replace(/\D/g, '') || 0) % LEAGUE_NAMES.length]} League`;

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
      return { title: leagueName(first.league_id as number), body: `${at(first.username)} just passed you by ${xp(gap)}. ${back}`, url: '/league' };
    }
    case 'league_result': {
      const name = leagueName(first.league_id as number);
      const place = num(first.place);
      const prize = num(first.prize);
      return {
        title: `${name} is over`,
        body: prize > 0
          ? `You finished ${ordinal(place)} and won ${xp(prize)}! A new league starts now.`
          : `You finished ${ordinal(place)} of ${num(first.of)}. A new league starts now.`,
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
