import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEAGUE_TIERS as CORE_TIERS, ordinal as coreOrdinal, theTier as coreTheTier, tierName as coreTierName } from '@brainscroll/core';
import { chunk, cronAuthorized, expoMessages, goneTokens, LEAGUE_TIERS, ordinal, renderPush, theTier, tierName, type PushKind } from '../../backend/supabase/functions/_shared/push.ts';

const KINDS: PushKind[] = ['friend_request', 'friend_new', 'passed', 'league_result', 'reaction'];
const sample = (kind: PushKind, n = 1) =>
  Array.from({ length: n }, (_, i) => ({ username: ['ana', 'ben', 'cyrus', 'dee'][i % 4], user_id: `u${i}`, gap: 30, league_id: 9, tier: 4, place: 2, of: 18, prize: 500, moved: 0 }));

test('every kind renders, alone and grouped, with a route to open', () => {
  for (const kind of KINDS)
    for (const n of [1, 2, 3]) {
      const r = renderPush(kind, sample(kind, n));
      assert.ok(r && r.title && r.body && r.url.startsWith('/'), `${kind} x${n}`);
    }
  assert.equal(renderPush('friend_new', sample('friend_new'))!.body, 'You and @ana are friends now. See how you compare!');
  assert.equal(renderPush('friend_new', sample('friend_new'))!.url, '/person/u0');
  assert.equal(renderPush('reaction', sample('reaction', 3))!.body, '@ana and 2 others liked your moments in the feed.');
  assert.equal(renderPush('passed', sample('passed'))!.body, '@ana just passed you by 30 XP. One level could put you back in front.');
  assert.equal(renderPush('passed', [{ username: 'ana', gap: 260, league_id: 9 }])!.body, '@ana just passed you by 260 XP. A couple of levels could put you back in front.');
  assert.equal(renderPush('league_result', sample('league_result'))!.body, 'You finished 2nd and won 500 XP! A new league starts now.');
  assert.equal(renderPush('league_result', [{ league_id: 9, place: 11, of: 18, prize: 0 }])!.body, 'You finished 11th of 18. A new league starts now.');
  assert.equal(renderPush('passed', sample('passed'))!.title, 'Sapphire League', 'a pass is titled with your tier');
  const up = renderPush('league_result', [{ league_id: 9, place: 1, of: 18, prize: 1000, moved: 1, tier: 5 }])!;
  assert.equal(`${up.title} ${up.body}`, 'Welcome to the Emerald League! You finished 1st and won 1,000 XP! You moved up a league.');
  assert.equal(renderPush('league_result', [{ league_id: 9, place: 2, of: 18, prize: 500, moved: 1, tier: 8 }])!.title, 'Welcome to the Crown League!');
  assert.equal(renderPush('league_result', [{ league_id: 9, place: 17, of: 18, prize: 0, moved: -1, tier: 3 }])!.body, 'You finished 17th of 18. This week you’re in the Aquamarine League.');
  assert.equal(renderPush('reaction', []), null, 'nothing to say, nothing sent');
});

test('the copy is warm: no guilt, threats, fake deadlines or em dashes', () => {
  const banned = /(lose|losing|lost|don'?t let|miss out|last chance|hurry|shame|disappoint|before it'?s too late|falling behind|abandon|forget about you)/i;
  const emDash = String.fromCharCode(0x2014);
  for (const kind of KINDS)
    for (const n of [1, 2, 4]) {
      for (const moved of [-1, 0, 1]) {
        const r = renderPush(kind, sample(kind, n).map((i) => ({ ...i, moved })))!;
        assert.doesNotMatch(`${r.title} ${r.body}`, banned, `${kind}: ${r.body}`);
        assert.ok(!`${r.title} ${r.body}`.includes(emDash), `${kind}: no em dash`);
      }
    }
});

test('league tiers and ordinals match core', () => {
  assert.deepEqual([...LEAGUE_TIERS], [...CORE_TIERS]);
  for (let t = 0; t <= 9; t++) assert.equal(`${tierName(t)}|${theTier(t)}`, `${coreTierName(t)}|${coreTheTier(t)}`);
  for (const n of [1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111]) assert.equal(ordinal(n), coreOrdinal(n));
});

test('one Expo message per device, chunked by 100; gone devices are found', () => {
  const msgs = expoMessages([
    { user_id: 'a', kind: 'friend_request', tokens: ['ExponentPushToken[a1]', 'ExponentPushToken[a2]'], items: sample('friend_request') },
    { user_id: 'b', kind: 'reaction', tokens: [], items: sample('reaction') },
  ]);
  assert.equal(msgs.length, 2);
  assert.deepEqual(msgs[0], { to: 'ExponentPushToken[a1]', title: 'New friend request', body: '@ana wants to be friends on BrainScroll.', sound: 'default', data: { url: '/social' }, channelId: 'social' });
  assert.deepEqual(chunk(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length), [100, 100, 50]);
  assert.deepEqual(goneTokens(msgs, [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }]), ['ExponentPushToken[a2]']);
  assert.deepEqual(goneTokens(msgs, [{ status: 'error', details: { error: 'MessageRateExceeded' } }]), [], 'only gone devices are forgotten');
});

test('the cron call needs the shared secret', () => {
  assert.equal(cronAuthorized('Bearer s3cret', 's3cret'), true);
  assert.equal(cronAuthorized('Bearer nope', 's3cret'), false);
  assert.equal(cronAuthorized(null, 's3cret'), false);
  assert.equal(cronAuthorized('Bearer ', undefined), false, 'no secret configured: refuse everything');
});
