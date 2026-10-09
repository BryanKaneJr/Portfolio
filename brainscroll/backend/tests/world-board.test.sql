-- The world leaderboard: places by total XP, all time; the top 50 and you; everyone named; blocked left off.
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
create function pg_temp.filler(i int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-' || lpad(to_hex(4096 + i), 12, '0'))::uuid $$;
create function pg_temp.places(b jsonb) returns int[] language sql as $$ select array(select (r ->> 'place')::int from jsonb_array_elements(b -> 'rows') r) $$;
create function pg_temp.row_at(b jsonb, p int) returns jsonb language sql as $$ select r from jsonb_array_elements(b -> 'rows') r where (r ->> 'place')::int = p $$;

-- c1..c9, d1..d5: 1,400 XP down to 100. Everything counts, all time: c9's league prize and d5's XP
-- from last month put them on top. Then fifty more learners with 50 XP each. e1: none yet.
insert into auth.users (id) select pg_temp.uid(c) from unnest(array['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'd1', 'd2', 'd3', 'd4', 'd5', 'e1']) c;
insert into auth.users (id) select pg_temp.filler(i) from generate_series(1, 50) i;
insert into public.xp_events (user_id, type, amount, idempotency_key)
select pg_temp.uid(c), 'QUEST_COMPLETE', 1500 - 100 * i, 'test:' || c
from unnest(array['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'd1', 'd2', 'd3', 'd4', 'd5']) with ordinality as t(c, i);
insert into public.xp_events (user_id, type, amount, idempotency_key) values (pg_temp.uid('c9'), 'LEAGUE_FINISH', 5000, 'test:prize');
insert into public.xp_events (user_id, type, amount, idempotency_key, created_at) values (pg_temp.uid('d5'), 'QUEST_COMPLETE', 9000, 'test:old', now() - interval '40 days');
insert into public.xp_events (user_id, type, amount, idempotency_key) select pg_temp.filler(i), 'QUEST_COMPLETE', 50, 'test:filler' from generate_series(1, 50) i;
-- Places: d5 9,100 (1st), c9 5,600 (2nd), c1 (3rd), c2 (4th) ... c8 (10th), d1 (11th), d2 (12th), d3 (13th), d4 (14th), fillers 15th to 64th.
-- d3 has friends c5 (7th, a private profile) and c8 (10th); c2 (4th) is private; d3 blocked c3 (5th).
insert into public.friendships (user_id, friend_id) values
  (pg_temp.uid('d3'), pg_temp.uid('c5')), (pg_temp.uid('c5'), pg_temp.uid('d3')),
  (pg_temp.uid('d3'), pg_temp.uid('c8')), (pg_temp.uid('c8'), pg_temp.uid('d3'));
update public.profiles set private_profile = true where id in (pg_temp.uid('c2'), pg_temp.uid('c5'));
insert into public.user_blocks (user_id, blocked_id) values (pg_temp.uid('d3'), pg_temp.uid('c3'));
set role authenticated;

-- 1. d3's board: the top 50 but c3, everyone named, d3 at 13th.
select pg_temp.as_user(pg_temp.uid('d3')::text);
do $$
declare b jsonb := public.get_world_board();
begin
  assert (b ->> 'ranked')::int = 64, format('64 learners have XP, got %s', b ->> 'ranked');
  assert pg_temp.places(b) = array(select g from generate_series(1, 50) g where g <> 5), format('places, got %s', pg_temp.places(b));
  assert (pg_temp.row_at(b, 1) ->> 'total_xp')::int = 9100 and pg_temp.row_at(b, 1) ->> 'id' = pg_temp.uid('d5')::text, 'old XP counts: the board never resets';
  assert (pg_temp.row_at(b, 2) ->> 'total_xp')::int = 5600, 'a league prize counts';
  assert pg_temp.row_at(b, 4) ->> 'username' is not null and pg_temp.row_at(b, 4) ->> 'id' = pg_temp.uid('c2')::text, 'a private profile is named';
  assert pg_temp.row_at(b, 5) is null, 'someone you blocked is left off';
  assert (pg_temp.row_at(b, 7) ->> 'friend')::boolean and (pg_temp.row_at(b, 10) ->> 'friend')::boolean and not (pg_temp.row_at(b, 1) ->> 'friend')::boolean, 'friends are marked';
  assert (pg_temp.row_at(b, 13) ->> 'you')::boolean and (pg_temp.row_at(b, 13) ->> 'total_xp')::int = 300, 'you at 13th with 300 XP';
  assert (b -> 'you' ->> 'place')::int = 13 and (b -> 'you' ->> 'total_xp')::int = 300 and b -> 'you' ->> 'username' is not null, 'your own row';
  assert not exists (select 1 from jsonb_array_elements(b -> 'rows') r where r ->> 'username' is null), 'everyone shown has a username';
end $$;

-- 2. Blocked works both ways: c3 doesn't see d3.
select pg_temp.as_user(pg_temp.uid('c3')::text);
do $$
declare b jsonb := public.get_world_board();
begin
  assert pg_temp.row_at(b, 13) is null and (b -> 'you' ->> 'place')::int = 5, 'd3 is left off c3''s board';
end $$;

-- 3. Below the top 50: the rows stop at 50, and your row says where you are.
select pg_temp.as_user(pg_temp.filler(45)::text);
do $$
declare b jsonb := public.get_world_board();
begin
  assert jsonb_array_length(b -> 'rows') = 50 and pg_temp.row_at(b, 51) is null, 'fifty rows';
  assert (b -> 'you' ->> 'place')::int = 59 and (b -> 'you' ->> 'total_xp')::int = 50, format('you 59th, got %s', b -> 'you');
end $$;

-- 4. With no XP yet, you have no place.
select pg_temp.as_user(pg_temp.uid('e1')::text);
do $$
declare b jsonb := public.get_world_board();
begin
  assert b -> 'you' ->> 'place' is null and (b -> 'you' ->> 'total_xp')::int = 0, format('no place yet, got %s', b -> 'you');
  assert pg_temp.row_at(b, 5) ->> 'id' = pg_temp.uid('c3')::text, 'nobody left off for e1';
end $$;

-- 5. Signed in only.
select pg_temp.as_user('');
do $$ begin
  perform pg_temp.expect_error($q$ select public.get_world_board() $q$, 'NOT_AUTHENTICATED');
end $$;
reset role;
\o
\echo 'world-board: all assertions passed'
