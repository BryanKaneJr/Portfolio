-- Social push notifications: devices, the switch, the events that queue a note,
-- and the sending rules (quiet hours, the daily cap, grouping, expiry).
-- Mirrors the comment at the top of 20261028000000_social_push.sql.
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm <> code and sqlerrm not like code || '%' then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;
create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
create function pg_temp.uid(c text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || c)::uuid $$;
create function pg_temp.pending(c text, k text) returns int language sql as $$
  select count(*)::int from public.notification_outbox where user_id = pg_temp.uid(c) and kind = k and status = 'pending' $$;
create function pg_temp.xp(c text, n int, key text) returns void language sql as $$
  insert into public.xp_events (user_id, type, amount, reason, idempotency_key) values (pg_temp.uid(c), 'LEVEL_COMPLETE', n, 'test', key) $$;

-- 5a Ana, 5b Ben, 5c Cy (no device), 5d Dee (asleep: it's night where she lives).
insert into auth.users (id) select pg_temp.uid(c) from unnest(array['5a', '5b', '5c', '5d']) c;
update public.profiles set username = case id when pg_temp.uid('5a') then 'ana' when pg_temp.uid('5b') then 'ben' when pg_temp.uid('5c') then 'cyrus' else 'dee' end,
  timezone = (select name from pg_timezone_names where name like 'Etc/GMT%' and extract(hour from now() at time zone name) between 10 and 18 order by name limit 1)
where id in (pg_temp.uid('5a'), pg_temp.uid('5b'), pg_temp.uid('5c'));
update public.profiles set username = 'dee',
  timezone = (select name from pg_timezone_names where name like 'Etc/GMT%' and extract(hour from now() at time zone name) between 0 and 6 order by name limit 1)
where id = pg_temp.uid('5d');

-- 1. Devices: a valid Expo token registers, and moves with whoever signs in on it.
set role authenticated;
select pg_temp.as_user(pg_temp.uid('5a')::text);
do $$ begin
  perform pg_temp.expect_error($q$ select public.register_push_token('not-a-token', 'ios') $q$, 'INVALID_TOKEN');
  perform pg_temp.expect_error($q$ select public.register_push_token('ExponentPushToken[aaaaaaaaaaaaaaaa]', 'windows') $q$, 'INVALID_TOKEN');
  perform public.register_push_token('ExponentPushToken[aaaaaaaaaaaaaaaa]', 'ios');
  perform public.register_push_token('ExponentPushToken[shared0000000000]', 'android');
  assert (public.get_social() -> 'me' ->> 'social_notifications')::boolean, 'social notifications start on';
end $$;
select pg_temp.as_user(pg_temp.uid('5b')::text);
select public.register_push_token('ExponentPushToken[shared0000000000]', 'android');
select public.register_push_token('ExponentPushToken[bbbbbbbbbbbbbbbb]', 'ios');
select pg_temp.as_user(pg_temp.uid('5d')::text);
select public.register_push_token('ExponentPushToken[dddddddddddddddd]', 'ios');
reset role;
do $$ begin
  assert (select user_id from public.push_tokens where token = 'ExponentPushToken[shared0000000000]') = pg_temp.uid('5b'), 'a shared device follows the last sign-in';
  assert (select count(*) from public.push_tokens where user_id = pg_temp.uid('5a')) = 1;
end $$;

-- 2. A friend request queues a note for the other side; accepting tells the one who asked.
set role authenticated;
select pg_temp.as_user(pg_temp.uid('5a')::text);
select public.send_friend_request(pg_temp.uid('5b'));
reset role;
do $$ begin
  assert pg_temp.pending('5b', 'friend_request') = 1, 'Ben hears Ana asked';
  assert (select params ->> 'username' from public.notification_outbox where user_id = pg_temp.uid('5b') and kind = 'friend_request') = 'ana';
end $$;
set role authenticated;
select pg_temp.as_user(pg_temp.uid('5b')::text);
select public.respond_friend_request(pg_temp.uid('5a'), true);
reset role;
do $$ begin
  assert pg_temp.pending('5a', 'friend_new') = 1, 'Ana hears they''re friends';
  assert pg_temp.pending('5b', 'friend_new') = 0, 'Ben did it himself: no note';
  assert (select params ->> 'username' from public.notification_outbox where user_id = pg_temp.uid('5a') and kind = 'friend_new') = 'ben';
end $$;

-- 2b. Requests that are gone take their unsent note with them, and asking again doesn't ping again.
set role authenticated;
select pg_temp.as_user(pg_temp.uid('5c')::text);
select public.send_friend_request(pg_temp.uid('5d'));
select pg_temp.as_user(pg_temp.uid('5d')::text);
select public.respond_friend_request(pg_temp.uid('5c'), false);
select pg_temp.as_user(pg_temp.uid('5c')::text);
select public.send_friend_request(pg_temp.uid('5d'));
select pg_temp.as_user(pg_temp.uid('5d')::text);
select public.respond_friend_request(pg_temp.uid('5c'), false);
select pg_temp.as_user(pg_temp.uid('5c')::text);
select public.send_friend_request(pg_temp.uid('5d'));
reset role;
do $$ begin
  assert pg_temp.pending('5d', 'friend_request') = 1, 'asked, declined and asked again three times: one note waiting';
  assert (select count(*) from public.notification_outbox where user_id = pg_temp.uid('5d') and kind = 'friend_request') = 1, 'and only one ever queued';
end $$;
set role authenticated;
select public.remove_friend(pg_temp.uid('5d'));
reset role;
do $$ begin
  assert pg_temp.pending('5d', 'friend_request') = 0, 'a withdrawn request takes its note with it';
end $$;
-- Crossing requests: Dee's note about Cy goes; Cy hears they're friends, until the friendship ends.
set role authenticated;
select public.send_friend_request(pg_temp.uid('5d'));
select pg_temp.as_user(pg_temp.uid('5d')::text);
select public.send_friend_request(pg_temp.uid('5c'));
reset role;
do $$ begin
  assert pg_temp.pending('5d', 'friend_request') = 0, 'crossed: no "wants to be friends" note once they are friends';
  assert pg_temp.pending('5c', 'friend_new') = 1, 'Cy hears they''re friends';
end $$;
set role authenticated;
select public.remove_friend(pg_temp.uid('5c'));
reset role;
do $$ begin
  assert pg_temp.pending('5c', 'friend_new') = 0, 'an ended friendship takes its unsent note with it';
end $$;
-- A note already sent counts too: asking again within the week doesn't ping again.
set role authenticated;
select pg_temp.as_user(pg_temp.uid('5c')::text);
select public.send_friend_request(pg_temp.uid('5d'));
reset role;
update public.notification_outbox set status = 'sent', sent_at = now() where user_id = pg_temp.uid('5d') and kind = 'friend_request';
set role authenticated;
select pg_temp.as_user(pg_temp.uid('5d')::text);
select public.respond_friend_request(pg_temp.uid('5c'), false);
select pg_temp.as_user(pg_temp.uid('5c')::text);
select public.send_friend_request(pg_temp.uid('5d'));
select pg_temp.as_user(pg_temp.uid('5d')::text);
select public.respond_friend_request(pg_temp.uid('5c'), false);
reset role;
do $$ begin
  assert (select count(*) from public.notification_outbox where user_id = pg_temp.uid('5d') and kind = 'friend_request') = 1, 'sent once, not again';
  assert pg_temp.pending('5d', 'friend_request') = 0;
end $$;
delete from public.notification_outbox where user_id = pg_temp.uid('5d');

-- 3. A heart tells the owner, once: hearting again, or unliking and liking again, doesn't send another.
-- Ana has a moment to heart (a trophy this week); made-up moments can't be hearted.
insert into public.user_trophies (user_id, trophy_id, name) values (pg_temp.uid('5a'), 'trophy.quest_test', 'Test Quest');
set role authenticated;
select pg_temp.as_user(pg_temp.uid('5b')::text);
select public.react(pg_temp.uid('5a'), 'trophy:trophy.quest_test', 'heart');
select public.react(pg_temp.uid('5a'), 'trophy:trophy.quest_test', 'heart');
reset role;
do $$ begin
  assert pg_temp.pending('5a', 'reaction') = 1, 'one reaction, one note';
  assert (select params ->> 'item_key' from public.notification_outbox where user_id = pg_temp.uid('5a') and kind = 'reaction') = 'trophy:trophy.quest_test';
end $$;
set role authenticated;
select public.react(pg_temp.uid('5a'), 'trophy:trophy.quest_test', null);
reset role;
do $$ begin
  assert pg_temp.pending('5a', 'reaction') = 0, 'a heart taken back takes its note with it';
end $$;
set role authenticated;
select public.react(pg_temp.uid('5a'), 'trophy:trophy.quest_test', 'heart');
do $$ begin
  perform pg_temp.expect_error($q$ select public.react(pg_temp.uid('5a'), 'trophy:does_not_exist', 'heart') $q$, 'MOMENT_NOT_FOUND');
end $$;
reset role;
do $$ begin
  assert pg_temp.pending('5a', 'reaction') = 1, 'liked, unliked and liked again: one note';
  assert not exists (select 1 from public.feed_reactions where item_key = 'trophy:does_not_exist'), 'no heart on a made-up moment';
end $$;

-- 4. Passing someone in the league: they hear once a day, with the gap.
select public.join_league(pg_temp.uid(c)) from unnest(array['5a', '5b', '5c']) c;
select pg_temp.xp('5a', 50, 'a1');
select pg_temp.xp('5b', 80, 'b1');
do $$ begin
  assert pg_temp.pending('5a', 'passed') = 1, 'Ben passed Ana';
  assert (select (params ->> 'gap')::int from public.notification_outbox where user_id = pg_temp.uid('5a') and kind = 'passed') = 30, 'by 30 XP';
  assert pg_temp.pending('5c', 'passed') = 0, 'Cy has no XP this week: nobody pings him';
end $$;
select pg_temp.xp('5b', 10, 'b2');
select pg_temp.xp('5a', 100, 'a2');
select pg_temp.xp('5b', 200, 'b3');
do $$ begin
  assert pg_temp.pending('5b', 'passed') = 1, 'Ana passed Ben';
  assert pg_temp.pending('5a', 'passed') = 1, 'passed again the same day: still one note';
end $$;
insert into public.xp_events (user_id, type, amount, reason, idempotency_key) values (pg_temp.uid('5a'), 'LEAGUE_FINISH', 1000, 'test', 'lf');
do $$ begin
  assert pg_temp.pending('5b', 'passed') = 1, 'league prizes never pass anyone';
end $$;

-- 5. A finished week: everyone who played hears their place and prize, once.
update public.leagues set week_start = week_start - 7 where true;
update public.league_members set week_start = week_start - 7 where true;
update public.xp_events set created_at = created_at - interval '7 days' where type <> 'LEAGUE_FINISH';
delete from public.xp_events where idempotency_key = 'lf';
do $$
declare r jsonb;
begin
  assert public.finalize_due_leagues() >= 1;
  r := (select params from public.notification_outbox where user_id = pg_temp.uid('5b') and kind = 'league_result');
  assert (r ->> 'place')::int = 1 and (r ->> 'prize')::int = 1000 and (r ->> 'of')::int = 3, format('Ben won, got %s', r);
  r := (select params from public.notification_outbox where user_id = pg_temp.uid('5a') and kind = 'league_result');
  assert (r ->> 'place')::int = 2 and (r ->> 'prize')::int = 500, format('Ana came 2nd, got %s', r);
  assert pg_temp.pending('5c', 'league_result') = 0, 'Cy didn''t play: no result note';
  perform public.finalize_due_leagues();
  assert (select count(*) from public.notification_outbox where kind = 'league_result') = 2, 'once';
end $$;

-- 6. Sending: grouped per kind, newest first; quiet hours wait; nobody to tell is skipped.
insert into public.notification_outbox (user_id, kind, params) values
  (pg_temp.uid('5c'), 'reaction', '{"username": "ana"}'),
  (pg_temp.uid('5d'), 'reaction', '{"username": "ana"}'),
  (pg_temp.uid('5a'), 'reaction', '{"username": "cyrus"}');
do $$
declare out jsonb; g jsonb;
begin
  out := public.claim_social_pushes();
  g := (select x from jsonb_array_elements(out) x where x ->> 'user_id' = pg_temp.uid('5a')::text and x ->> 'kind' = 'reaction');
  assert jsonb_array_length(g -> 'items') = 2 and g -> 'items' -> 0 ->> 'username' = 'cyrus', format('two reactions in one note, newest first: %s', g);
  assert g -> 'tokens' = '["ExponentPushToken[aaaaaaaaaaaaaaaa]"]'::jsonb, format('to Ana''s device: %s', g -> 'tokens');
  assert (select count(*) from jsonb_array_elements(out) x where x ->> 'user_id' = pg_temp.uid('5a')::text) = 4,
    format('Ana''s four kinds go out (friend, reaction, passed, league): %s', out);
  assert (select status from public.notification_outbox where user_id = pg_temp.uid('5c') and kind = 'reaction') = 'skipped', 'Cy has no device';
  assert pg_temp.pending('5d', 'reaction') = 1, 'Dee is asleep: hers waits';
  assert not exists (select 1 from jsonb_array_elements(out) x where x ->> 'user_id' = pg_temp.uid('5d')::text), 'nothing to Dee at night';
  assert jsonb_array_length(public.claim_social_pushes()) = 0, 'claimed once';
end $$;

-- 7. At most 4 a day: Ana's fifth kind of note today waits until tomorrow.
insert into public.notification_outbox (user_id, kind, params) values (pg_temp.uid('5a'), 'friend_request', '{"username": "cyrus"}');
do $$ begin
  assert jsonb_array_length(public.claim_social_pushes()) = 0, 'Ana has had 4 today';
  assert pg_temp.pending('5a', 'friend_request') = 1, 'it waits';
end $$;
-- Ben switches social notes off: his pending ones are skipped.
set role authenticated;
select pg_temp.as_user(pg_temp.uid('5b')::text);
select public.set_social_notifications(false);
reset role;
insert into public.notification_outbox (user_id, kind, params) values (pg_temp.uid('5b'), 'reaction', '{"username": "ana"}');
do $$ begin
  perform public.claim_social_pushes();
  assert (select status from public.notification_outbox where user_id = pg_temp.uid('5b') and kind = 'reaction') = 'skipped', 'switched off';
end $$;
-- Notes older than a day are dropped, not sent late.
insert into public.notification_outbox (user_id, kind, params, created_at) values (pg_temp.uid('5d'), 'friend_new', '{"username": "ana"}', now() - interval '25 hours');
do $$ begin
  perform public.claim_social_pushes();
  assert (select status from public.notification_outbox where user_id = pg_temp.uid('5d') and kind = 'friend_new') = 'expired';
end $$;

-- 8. Gone devices are forgotten; old notes are cleared after a week.
do $$ begin
  assert public.forget_push_tokens(array['ExponentPushToken[dddddddddddddddd]']) = 1;
  update public.notification_outbox set created_at = now() - interval '8 days' where status <> 'pending';
  assert public.prune_outbox() > 0;
  assert not exists (select 1 from public.notification_outbox where status <> 'pending');
end $$;

-- 9. Learners can't read devices or notes, or send anything; signing out forgets the device.
set role authenticated;
select pg_temp.as_user(pg_temp.uid('5a')::text);
do $$ begin
  perform pg_temp.expect_error($q$ select count(*) from public.push_tokens $q$, 'permission denied for table push_tokens');
  perform pg_temp.expect_error($q$ select count(*) from public.notification_outbox $q$, 'permission denied for table notification_outbox');
  perform pg_temp.expect_error($q$ select public.claim_social_pushes() $q$, 'permission denied for function claim_social_pushes');
  perform pg_temp.expect_error($q$ select public.enqueue_push(pg_temp.uid('5b'), 'reaction', '{}') $q$, 'permission denied for function enqueue_push');
  perform public.unregister_push_token('ExponentPushToken[aaaaaaaaaaaaaaaa]');
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from public.push_tokens where user_id = pg_temp.uid('5a')), 'signed out: no device';
end $$;
\echo push: all assertions passed
