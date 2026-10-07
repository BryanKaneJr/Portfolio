-- Map chests, XP boosts and the look (migration 20261106000000_rewards.sql).
-- Mirrors packages/core/test/rewards.test.ts and the boost case in completion.test.ts.
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;
-- Alice has cleared `n` levels of the testing skill (set directly; core-loop covers clearing).
create function pg_temp.cleared(n int) returns void language sql as $$
  insert into public.user_skill_progress (user_id, skill_id, highest_cleared, stars)
  values ('00000000-0000-0000-0000-00000000000a', 'skill.science.testing', n, n / 100)
  on conflict (user_id, skill_id) do update set highest_cleared = excluded.highest_cleared, stars = excluded.stars
$$;
create function pg_temp.loot(p jsonb) returns void language sql as $$
  update public.app_settings set chest_loot =
    '{"boost_15": 0, "boost_30": 0, "boost_60": 0, "brainpower": 0, "common": 0, "rare": 0, "epic": 0, "legendary": 0}'::jsonb || p
  where true
$$;
create function pg_temp.set_bp(n int) returns void language sql as $$
  update public.user_brainpower set balance = n, as_of = public.brainpower_today(user_id) where user_id = '00000000-0000-0000-0000-00000000000a'
$$;
create function pg_temp.q(n int) returns text language sql as $$ select 'question.testing.' || lpad(n::text, 3, '0') || '.q1' $$;
create function pg_temp.lvl(n int) returns text language sql as $$ select 'level.science.testing.' || lpad(n::text, 3, '0') $$;
create function pg_temp.clear(n int, first text) returns jsonb language plpgsql as $$
begin
  perform public.answer_question(pg_temp.lvl(n), pg_temp.q(n), first);
  if first <> 'a' then perform public.answer_question(pg_temp.lvl(n), pg_temp.q(n), 'a'); end if;
  return public.complete_level(pg_temp.lvl(n), 1, gen_random_uuid());
end $$;
update public.app_settings set brainpower_perfect_drop_percent = 0 where true;
grant execute on function pg_temp.err(text) to authenticated;

-- 1. The catalog matches core COSMETICS (also checked by rewards-sync.test.ts).
do $$ begin
  assert (select count(*) from public.cosmetic_items) = 27, 'eleven glows, eight name styles, eight titles';
  assert (select sum(value::int) from jsonb_each_text((select chest_loot from public.app_settings))) = 100, 'weights total 100';
end $$;

-- 2. Locked until the chapter's 5th level; unknown chests aren't found.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$ begin
  assert pg_temp.err($q$select public.open_chest('skill.science.testing', 1)$q$) = 'CHEST_LOCKED', 'nothing cleared';
  assert pg_temp.err($q$select public.open_chest('skill.science.nope', 1)$q$) = 'CHEST_NOT_FOUND', 'no such skill';
  assert pg_temp.err($q$select public.open_chest('skill.science.testing', 0)$q$) = 'CHEST_NOT_FOUND', 'no chapter 0';
end $$;
reset role;

-- 3. +2 Brainpower when both fit, once.
select pg_temp.cleared(5);
select pg_temp.loot('{"brainpower": 100}');
select public.brainpower_lock('00000000-0000-0000-0000-00000000000a');
select pg_temp.set_bp(3);
set role authenticated;
do $$
declare r jsonb := public.open_chest('skill.science.testing', 1);
begin
  assert r -> 'reward' = '{"kind": "brainpower", "amount": 2}', format('got %s', r);
  assert (r -> 'daily' ->> 'brainpower')::int = 5, format('3 + 2: %s', r -> 'daily');
  assert r -> 'daily' -> 'brainpower_earned' @> '[{"kind": "chest", "granted": 1}]', format('earned: %s', r -> 'daily');
  assert r -> 'locker' -> 'chests' = '["chest:skill.science.testing:1"]', format('locker: %s', r -> 'locker');
  assert pg_temp.err($q$select public.open_chest('skill.science.testing', 1)$q$) = 'CHEST_OPENED', 'once ever';
  assert pg_temp.err($q$select public.open_chest('skill.science.testing', 2)$q$) = 'CHEST_LOCKED', 'chapter 2 waits for Level 15';
end $$;
reset role;

-- 4. Without room for both, the Brainpower roll becomes the 15-minute boost (also on Unlimited).
select pg_temp.cleared(25);
select pg_temp.set_bp(9);
set role authenticated;
do $$
declare r jsonb := public.open_chest('skill.science.testing', 2);
begin
  assert r -> 'reward' ->> 'kind' = 'boost' and (r -> 'reward' ->> 'minutes')::int = 15, format('got %s', r);
  assert (r -> 'daily' ->> 'brainpower')::int = 9, 'nothing paid past the max';
  assert (r -> 'locker' -> 'boosts' -> 0 ->> 'started_at') is null, 'kept until started';
end $$;
reset role;
insert into public.entitlements (user_id, entitlement, active) values ('00000000-0000-0000-0000-00000000000a', 'unlimited_learning', true);
select pg_temp.set_bp(0);
set role authenticated;
do $$ begin
  assert public.open_chest('skill.science.testing', 3) -> 'reward' ->> 'kind' = 'boost', 'Unlimited never rolls Brainpower';
end $$;
reset role;
delete from public.entitlements where user_id = '00000000-0000-0000-0000-00000000000a';

-- 5. Cosmetics: never a duplicate; a collected tier becomes the 15-minute boost.
select pg_temp.cleared(100);
select pg_temp.loot('{"common": 100}');
set role authenticated;
do $$
declare
  r jsonb;
  c int;
begin
  for c in 4 .. 9 loop
    r := public.open_chest('skill.science.testing', c);
    assert r -> 'reward' ->> 'kind' = 'cosmetic' and r -> 'reward' ->> 'tier' = 'common', format('chapter %s: %s', c, r);
  end loop;
  assert jsonb_array_length(r -> 'locker' -> 'cosmetics') = 6, format('six different commons: %s', r -> 'locker');
  assert (select count(distinct x) from jsonb_array_elements_text(r -> 'locker' -> 'cosmetics') x) = 6, 'all different';
  r := public.open_chest('skill.science.testing', 10);
  assert r -> 'reward' ->> 'kind' = 'boost' and (r -> 'reward' ->> 'minutes')::int = 15, format('all owned: %s', r);
end $$;
reset role;

-- 6. A tier above the learner's Knowledge Level is out of the roll (Bob: 5 levels, Knowledge Level 5).
select pg_temp.loot('{"rare": 50, "legendary": 50}');
insert into public.user_skill_progress (user_id, skill_id, highest_cleared) values ('00000000-0000-0000-0000-00000000000b', 'skill.science.testing', 5);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
do $$
declare r jsonb := public.open_chest('skill.science.testing', 1);
begin
  assert r -> 'reward' ->> 'kind' = 'boost', format('rare needs Knowledge Level 15: %s', r);
end $$;
reset role;

-- 7. Boosts: one at a time, each once.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare
  l jsonb := public.get_locker();
  b1 uuid := (l -> 'boosts' -> 0 ->> 'id')::uuid;
  b2 uuid := (l -> 'boosts' -> 1 ->> 'id')::uuid;
begin
  assert l -> 'active_boost' = 'null'::jsonb or l -> 'active_boost' is null, format('none running: %s', l);
  assert pg_temp.err(format('select public.start_boost(%L)', gen_random_uuid())) = 'BOOST_NOT_FOUND', 'not hers';
  l := public.start_boost(b1);
  assert l -> 'active_boost' ->> 'id' = b1::text, format('running: %s', l);
  assert pg_temp.err(format('select public.start_boost(%L)', b2)) = 'BOOST_ACTIVE', 'one at a time';
  assert pg_temp.err(format('select public.start_boost(%L)', b1)) = 'BOOST_USED', 'once';
end $$;
reset role;

-- 8. A boosted first clear pays 2x in its one event; the streak never takes it past 2x. Bob plays.
insert into public.user_boosts (user_id, minutes, source, started_at, ends_at)
values ('00000000-0000-0000-0000-00000000000b', 15, 'test', now(), now() + interval '15 minutes');
delete from public.user_skill_progress where user_id = '00000000-0000-0000-0000-00000000000b';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
do $$
declare s jsonb := pg_temp.clear(1, 'a');
begin
  assert (s ->> 'xp_awarded')::int = 200 and (s ->> 'boosted')::boolean and (s ->> 'boost_bonus_xp')::int = 100, format('got %s', s);
  s := pg_temp.clear(2, 'a');
  assert (s ->> 'xp_awarded')::int = 200 and (s ->> 'perfect_streak_bonus_xp')::int = 10 and (s ->> 'boost_bonus_xp')::int = 90, format('streak inside 2x: %s', s);
  assert (select count(*) from public.xp_events where user_id = auth.uid() and level_id = pg_temp.lvl(2)) = 1, 'one event';
end $$;
reset role;
do $$ begin
  assert public.weekly_xp('00000000-0000-0000-0000-00000000000b', public.league_week_start(now())) = 400, 'counts toward the league';
end $$;
update public.user_boosts set started_at = now() - interval '20 minutes', ends_at = now() - interval '5 minutes' where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
do $$
declare s jsonb := pg_temp.clear(3, 'a');
begin
  assert not (s ->> 'boosted')::boolean and (s ->> 'boost_bonus_xp')::int = 0 and (s ->> 'xp_awarded')::int = 120, format('over: %s', s);
end $$;
reset role;

-- 9. The look: only owned items of the right kind; Mastery titles need the star; one title shows.
insert into public.quests (id, title, tagline, art, xp_reward, trophy_id, trophy_name, title_reward, status)
values ('quest.look', 'Q', 'Q.', 'rome.colosseum', 50, 'trophy.look', 'Q', 'Citizen of Rome', 'published');
insert into public.user_trophies (user_id, trophy_id, name, quest_id) values ('00000000-0000-0000-0000-00000000000a', 'trophy.look', 'Q', 'quest.look');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare
  owned text[] := array(select jsonb_array_elements_text(public.get_locker() -> 'cosmetics'));
  ring text := (select x from unnest(owned) x where x like 'ring.%' limit 1);
  title text := (select x from unnest(owned) x where x like 'title.%' limit 1);
  l jsonb;
  card jsonb;
begin
  assert pg_temp.err($q$select public.set_look('ring.galaxy', null, null)$q$) = 'NOT_OWNED', 'not won';
  assert pg_temp.err(format('select public.set_look(null, %L, null)', ring)) = 'NOT_OWNED', 'a ring is not a name style';
  perform public.set_equipped('quest.look', null);
  l := public.set_look(ring, 'name.plum', title);
  assert l -> 'look' = jsonb_build_object('ring', ring, 'name_style', 'name.plum', 'title', title), format('worn: %s', l);
  assert (select equipped_title_quest from public.profiles where id = auth.uid()) is null, 'a look title takes off the quest title';
  card := public.get_social_profile(auth.uid());
  assert card ->> 'ring' = ring and card ->> 'name_style' = 'name.plum' and card ->> 'title' = (select name from public.cosmetic_items where id = title),
    format('others see it: %s', card);
  perform public.set_equipped('quest.look', null);
  assert (public.get_locker() -> 'look' ->> 'title') is null, 'a quest title takes off the look title';
  assert public.get_social_profile(auth.uid()) ->> 'title' = 'Citizen of Rome', 'and shows instead';
  l := public.set_look(null, null, 'title.mastery.science.testing');
  assert public.get_social_profile(auth.uid()) ->> 'title' = 'Testing Master', 'a Mastery title, with its star';
end $$;
reset role;
select pg_temp.cleared(99);
set role authenticated;
do $$ begin
  assert pg_temp.err($q$select public.set_look(null, null, 'title.mastery.science.testing')$q$) = 'NOT_OWNED', 'no star, no Mastery title';
end $$;
reset role;

\o
\echo rewards: all assertions passed
