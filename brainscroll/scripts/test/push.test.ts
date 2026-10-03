import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leagueName as coreLeagueName, ordinal as coreOrdinal } from '@brainscroll/core';
import { chunk, cronAuthorized, expoMessages, goneTokens, leagueName, ordinal, renderPush, type PushKind } from '../../backend/supabase/functions/_shared/push.ts';

const KINDS: PushKind[] = ['friend_request', 'friend_new', 'passed', 'league_result', 'reaction'];
const sample = (kind: PushKind, n = 1) =>
  Array.from({ length: n }, (_, i) => ({ username: ['ana', 'ben', 'cyrus', 'dee'][i % 4], user_id: `u${i}`, gap: 30, league_id: 9, place: 2, of: 18, prize: 500 }));

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
  assert.equal(renderPush('reaction', []), null, 'nothing to say, nothing sent');
});

test('the copy is warm: no guilt, threats, fake deadlines or em dashes', () => {
  const banned = /(lose|losing|lost|don'?t let|miss out|last chance|hurry|shame|disappoint|before it'?s too late|falling behind|abandon|forget about you)/i;
  const emDash = String.fromCharCode(0x2014);
  for (const kind of KINDS)
    for (const n of [1, 2, 4]) {
      const r = renderPush(kind, sample(kind, n))!;
      assert.doesNotMatch(`${r.title} ${r.body}`, banned, `${kind}: ${r.body}`);
      assert.ok(!`${r.title} ${r.body}`.includes(emDash), `${kind}: no em dash`);
    }
});

test('league names and ordinals match core', () => {
  for (let id = 0; id < 30; id++) assert.equal(leagueName(id), coreLeagueName(id));
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
