-- The world leaderboard: this week's places, which ten rows show, and who stays hidden.
-- Mirrors packages/core/src/social.ts (worldBoardPlaces).
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm <> code then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;
create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
create function pg_temp.uid(c text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || c)::uuid $$;
create function pg_temp.places(b jsonb) returns int[] language sql as $$ select array(select (r ->> 'place')::int from jsonb_array_elements(b -> 'rows') r) $$;
create function pg_temp.row_at(b jsonb, p int) returns jsonb language sql as $$ select r from jsonb_array_elements(b -> 'rows') r where (r ->> 'place')::int = p $$;

-- 1. The rows: mirrors core worldBoardPlaces case by case.
do $$ begin
  assert public.world_board_places(1, 1, '{}') = array[1];
  assert public.world_board_places(6, 4, array[2]) = array[1, 2, 3, 4, 5, 6];
  assert public.world_board_places(500, 120, array[400, 90, 130, 5, 118]) = array[1, 2, 3, 5, 90, 118, 119, 120, 130, 400], 'top 3, you, then friends nearest you';
  assert public.world_board_places(500, 100, array[10, 20, 30, 40, 50, 60, 70, 80, 90, 99, 101]) = array[1, 2, 3, 60, 70, 80, 90, 99, 100, 101], 'only the nearest friends';
  assert public.world_board_places(500, 50, '{}') = array[1, 2, 3, 47, 48, 49, 50, 51, 52, 53], 'then the places around you, above first';
  assert public.world_board_places(12, 12, '{}') = array[1, 2, 3, 6, 7, 8, 9, 10, 11, 12];
  assert public.world_board_places(500, 2, '{}') = array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert public.world_board_places(41, 41, array[7]) = array[1, 2, 3, 7, 36, 37, 38, 39, 40, 41], 'no XP yet: you come last';
end $$;

-- c1..c9, d1..d5: fourteen learners with 1,400 XP down to 100 this week (places 1 to 14). e1: none yet.
insert into auth.users (id) select pg_temp.uid(c) from unnest(array['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'd1', 'd2', 'd3', 'd4', 'd5', 'e1']) c;
insert into public.xp_events (user_id, type, amount, idempotency_key)
select pg_temp.uid(c), 'QUEST_COMPLETE', 1500 - 100 * i, 'test:' || c
from unnest(array['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'd1', 'd2', 'd3', 'd4', 'd5']) with ordinality as t(c, i);
-- What doesn't count: a league prize this week, and last week's XP.
insert into public.xp_events (user_id, type, amount, idempotency_key) values (pg_temp.uid('c9'), 'LEAGUE_FINISH', 5000, 'test:prize');
insert into public.xp_events (user_id, type, amount, idempotency_key, created_at) values (pg_temp.uid('d5'), 'QUEST_COMPLETE', 9000, 'test:old', now() - interval '8 days');
-- d3 (12th) has friends c5 (5th, a private profile) and c8 (8th); c2 (2nd) is private; d3 blocked c3 (3rd).
insert into public.friendships (user_id, friend_id) values
  (pg_temp.uid('d3'), pg_temp.uid('c5')), (pg_temp.uid('c5'), pg_temp.uid('d3')),
  (pg_temp.uid('d3'), pg_temp.uid('c8')), (pg_temp.uid('c8'), pg_temp.uid('d3'));
update public.profiles set private_profile = true where id in (pg_temp.uid('c2'), pg_temp.uid('c5'));
insert into public.user_blocks (user_id, blocked_id) values (pg_temp.uid('d3'), pg_temp.uid('c3'));
set role authenticated;

-- 2. d3's board: the top 3, d3, both friends, then the places nearest 12th.
select pg_temp.as_user(pg_temp.uid('d3')::text);
do $$
declare b jsonb := public.get_world_board();
begin
  assert (b ->> 'ranked')::int = 14, format('fourteen learners have XP this week, got %s', b ->> 'ranked');
  assert pg_temp.places(b) = array[1, 2, 3, 5, 8, 10, 11, 12, 13, 14], format('places, got %s', pg_temp.places(b));
  assert (pg_temp.row_at(b, 12) ->> 'you')::boolean and (pg_temp.row_at(b, 12) ->> 'weekly_xp')::int = 300, 'you at 12th with 300 XP';
  assert (pg_temp.row_at(b, 1) ->> 'weekly_xp')::int = 1400 and pg_temp.row_at(b, 1) ->> 'username' is not null, 'the leader, named (given a username)';
  assert (pg_temp.row_at(b, 2) ->> 'hidden')::boolean and pg_temp.row_at(b, 2) ->> 'username' is null, 'a private profile outside your circle is hidden';
  assert (pg_temp.row_at(b, 3) ->> 'hidden')::boolean, 'someone you blocked is hidden';
  assert (pg_temp.row_at(b, 5) ->> 'friend')::boolean and not (pg_temp.row_at(b, 5) ->> 'hidden')::boolean, 'a private friend is shown, as your friend';
  assert (pg_temp.row_at(b, 8) ->> 'friend')::boolean and not (pg_temp.row_at(b, 1) ->> 'friend')::boolean, 'friends are marked';
  assert (pg_temp.row_at(b, 9) is null), '9th is left out';
  assert (pg_temp.row_at(b, 14) ->> 'weekly_xp')::int = 100, 'last week''s XP doesn''t count';
end $$;

-- 3. With no XP yet, you come one after the last place.
select pg_temp.as_user(pg_temp.uid('e1')::text);
do $$
declare b jsonb := public.get_world_board();
begin
  assert pg_temp.places(b) = array[1, 2, 3, 9, 10, 11, 12, 13, 14, 15], format('places, got %s', pg_temp.places(b));
  assert (pg_temp.row_at(b, 15) ->> 'you')::boolean and (pg_temp.row_at(b, 15) ->> 'weekly_xp')::int = 0, 'you last, with 0 XP';
  assert (pg_temp.row_at(b, 9) ->> 'weekly_xp')::int = 600, 'a league prize doesn''t count';
  assert (pg_temp.row_at(b, 2) ->> 'hidden')::boolean and not (pg_temp.row_at(b, 3) ->> 'hidden')::boolean, 'hidden for strangers only when private';
end $$;

-- 4. Signed in only.
select pg_temp.as_user('');
do $$ begin
  perform pg_temp.expect_error($q$ select public.get_world_board() $q$, 'NOT_AUTHENTICATED');
end $$;
reset role;
\o
\echo 'world-board: all assertions passed'
