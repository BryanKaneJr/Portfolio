-- Social: usernames, friends, invites, blocks, leagues (matching, the safety net, prizes),
-- the derived feed and its hearts. Mirrors packages/core/src/social.ts.
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

-- 2a: Alice, 2b: Bob, 2c: Carol, 2d..2f: more learners, 3a/3b: very advanced learners.
insert into auth.users (id) select pg_temp.uid(c) from unnest(array['2a', '2b', '2c', '2d', '2e', '2f', '3a', '3b']) c;
-- The advanced two have cleared thousands of levels: brain level 110 and 115 (well over 100).
insert into public.skills (id, subject_id, name, status) values ('skill.science.big', 'subject.science', 'Big', 'published');
insert into public.user_skill_progress (user_id, skill_id, highest_cleared) values (pg_temp.uid('3a'), 'skill.science.big', 3000), (pg_temp.uid('3b'), 'skill.science.big', 3300);
set role authenticated;

-- 1. Everyone gets a friendly username, an invite code and a starter avatar; usernames are checked.
select pg_temp.as_user(pg_temp.uid('2a')::text);
do $$
declare r jsonb;
begin
  r := public.get_social();
  assert r -> 'me' ->> 'username' ~ '^[a-z]+_[a-z]+_[0-9]{4}$', format('generated username, got %s', r);
  assert r -> 'me' ->> 'invite_code' ~ '^[A-Z0-9]{8}$', format('invite code, got %s', r);
  assert r -> 'me' ->> 'avatar' ~ '^avatar\.[a-z_]+$', format('a random starter avatar, no letter, got %s', r);
  perform pg_temp.expect_error($q$ select public.set_username('no') $q$, 'USERNAME_INVALID');
  perform pg_temp.expect_error($q$ select public.set_username('has space') $q$, 'USERNAME_INVALID');
  perform pg_temp.expect_error($q$ select public.set_username('the_drscroll') $q$, 'USERNAME_NOT_ALLOWED');
  assert public.set_username('Alice_Reads') ->> 'username' = 'alice_reads', 'usernames are lowercase';
end $$;
select pg_temp.as_user(pg_temp.uid('2b')::text);
do $$ begin
  perform pg_temp.expect_error($q$ select public.set_username('alice_reads') $q$, 'USERNAME_TAKEN');
  perform public.set_username('bob');
  assert public.find_user('ALICE_READS') ->> 'id' = pg_temp.uid('2a')::text, 'exact search finds her';
  assert public.find_user('alice') is null, 'no partial matches: search is not a directory';
  assert public.find_user('bob') is null, 'you never find yourself';
end $$;

-- 2. A request waits for the other side; accepting makes friends both ways.
do $$ begin
  assert public.send_friend_request(pg_temp.uid('2a')) = 'requested';
  assert public.send_friend_request(pg_temp.uid('2a')) = 'requested', 'asking twice is harmless';
  perform pg_temp.expect_error($q$ select public.send_friend_request(pg_temp.uid('2b')) $q$, 'USER_NOT_FOUND');
end $$;
select pg_temp.as_user(pg_temp.uid('2a')::text);
do $$
declare r jsonb;
begin
  r := public.get_social();
  assert jsonb_array_length(r -> 'incoming') = 1 and r -> 'incoming' -> 0 ->> 'username' = 'bob', format('Bob asked, got %s', r);
  perform public.respond_friend_request(pg_temp.uid('2b'), true);
  r := public.get_social();
  assert jsonb_array_length(r -> 'friends') = 1 and jsonb_array_length(r -> 'incoming') = 0, format('friends now, got %s', r);
end $$;
select pg_temp.as_user(pg_temp.uid('2b')::text);
do $$ begin
  assert jsonb_array_length(public.get_social() -> 'friends') = 1, 'friends both ways';
end $$;

-- 3. An invite link is the inviter's yes: opening it makes friends at once.
select pg_temp.as_user(pg_temp.uid('2c')::text);
do $$
declare v_code text;
begin
  reset role;
  select invite_code into v_code from public.profiles where id = pg_temp.uid('2a');
  set role authenticated;
  perform pg_temp.expect_error($q$ select public.accept_invite('NOPE1234') $q$, 'INVITE_NOT_FOUND');
  assert public.accept_invite(lower(v_code)) ->> 'id' = pg_temp.uid('2a')::text, 'codes are case-insensitive';
  assert jsonb_array_length(public.get_social() -> 'friends') = 1;
end $$;

-- 4. Leagues: anyone under brain level 100 is fair game, so the first learners share one.
create temp table lg (who text, league bigint);
grant all on lg to authenticated;
create function pg_temp.join(c text) returns bigint language plpgsql as $$
declare v bigint;
begin
  perform pg_temp.as_user(pg_temp.uid(c)::text);
  v := (public.get_league() ->> 'league_id')::bigint;
  insert into lg values (c, v);
  return v;
end $$;
select pg_temp.join(c) from unnest(array['2a', '2b', '2c']) c;
do $$ begin
  assert (select count(distinct league) from lg) = 1, 'the first three share a league';
  assert pg_temp.join('2a') = (select league from lg where who = '2a' limit 1), 'joining again keeps your league';
end $$;
-- The safety net: a level-110 learner with no match still joins a league under 5.
select pg_temp.join('3a');
do $$ begin
  assert (select league from lg where who = '3a') = (select league from lg where who = '2a' limit 1), 'safety net: no one starts alone';
end $$;
select pg_temp.join(c) from unnest(array['2d', '2e']) c;
do $$ begin
  assert (select count(distinct league) from lg where who in ('2a', '2d', '2e')) = 1, 'the advanced joiner doesn''t close the beginners'' league';
end $$;
-- Five or more now: the second advanced learner (115) gets their own league ...
select pg_temp.join('3b');
do $$ begin
  assert (select league from lg where who = '3b') <> (select league from lg where who = '2a' limit 1), 'no match and no small league: a new one';
end $$;
-- ... and a learner within 20% of 115 joins it rather than the beginners' league.
reset role;
insert into public.user_skill_progress (user_id, skill_id, highest_cleared) values (pg_temp.uid('2f'), 'skill.science.big', 3100);
set role authenticated;
select pg_temp.join('2f');
do $$ begin
  assert (select league from lg where who = '2f') = (select league from lg where who = '3b'), '110 to 115 is within 20%: same league';
end $$;

-- 5. Weekly XP orders the league. Bob clears a level this week.
select pg_temp.as_user(pg_temp.uid('2b')::text);
select public.answer_question('level.science.testing.001', 'question.testing.001.q1', 'a');
select public.complete_level('level.science.testing.001', 1, gen_random_uuid());
do $$
declare r jsonb;
begin
  r := public.get_league();
  assert r -> 'members' -> 0 ->> 'username' = 'bob' and (r -> 'members' -> 0 ->> 'weekly_xp')::int = 100 and (r -> 'members' -> 0 ->> 'you')::boolean,
    format('Bob leads with 100 XP, got %s', r -> 'members' -> 0);
  assert jsonb_array_length(r -> 'members') = 6;
end $$;

-- 6. When the week ends, the top 3 with XP are paid, once.
reset role;
update public.leagues set week_start = week_start - 7 where true;
update public.league_members set week_start = week_start - 7 where true;
update public.xp_events set created_at = created_at - interval '7 days' where true;
update public.user_level_progress set completed_at = completed_at - interval '7 days' where completed_at is not null;
update public.user_learning_days set first_at = first_at - interval '7 days', day = day - 7 where true;
set role authenticated;
select pg_temp.as_user(pg_temp.uid('2b')::text);
do $$
declare r jsonb;
begin
  r := public.get_league();
  assert (r -> 'last_week' ->> 'xp')::int = 1000, format('1st pays 1,000, got %s', r -> 'last_week');
  assert (select count(*) from public.xp_events where type = 'LEAGUE_FINISH') = 1, 'only places with XP are paid';
  assert (r ->> 'league_id')::bigint not in (select league from lg), 'a new week, a new league';
  assert (r -> 'members' -> 0 ->> 'weekly_xp')::int = 0, 'league prizes never count toward the next week';
  r := public.get_league();
  assert (select count(*) from public.xp_events where type = 'LEAGUE_FINISH') = 1, 'paid once';
end $$;
-- Alice opening Social later doesn't pay again.
select pg_temp.as_user(pg_temp.uid('2a')::text);
select public.get_league();
reset role;
do $$ begin
  assert (select count(*) from public.xp_events where type = 'LEAGUE_FINISH') = 1, 'still paid once, to Bob only';
end $$;
set role authenticated;

-- 7. The feed: Alice sees Bob's first-level trophy and his league win; the only reaction is a heart.
do $$
declare
  f jsonb;
  item jsonb;
begin
  f := public.get_feed();
  select x into item from jsonb_array_elements(f) x where x -> 'owner' ->> 'username' = 'bob' and x ->> 'key' = 'trophy:trophy.first_level';
  assert item is not null, format('Bob''s first trophy is in Alice''s feed, got %s', f);
  assert exists (select 1 from jsonb_array_elements(f) x where x -> 'owner' ->> 'username' = 'bob' and x ->> 'kind' = 'league'), 'and his league win';
  perform public.react(pg_temp.uid('2b'), 'trophy:trophy.first_level', 'heart');
  perform public.react(pg_temp.uid('2b'), 'trophy:trophy.first_level', 'heart');
  select x into item from jsonb_array_elements(public.get_feed()) x where x -> 'owner' ->> 'username' = 'bob' and x ->> 'key' = 'trophy:trophy.first_level';
  assert item -> 'reactions' = '{"heart": 1}'::jsonb and item ->> 'mine' = 'heart', format('one heart each, got %s', item);
  perform pg_temp.expect_error($q$ select public.react(pg_temp.uid('2b'), 'trophy:trophy.first_level', 'clapping') $q$,
    'new row for relation "feed_reactions" violates check constraint "feed_reactions_reaction_check"');
  perform public.react(pg_temp.uid('2b'), 'trophy:trophy.first_level', null);
  select x into item from jsonb_array_elements(public.get_feed()) x where x -> 'owner' ->> 'username' = 'bob' and x ->> 'key' = 'trophy:trophy.first_level';
  assert item -> 'reactions' = '{}'::jsonb and item -> 'mine' = 'null'::jsonb, format('unhearting takes it back, got %s', item);
  perform public.react(pg_temp.uid('2b'), 'trophy:trophy.first_level', 'heart');
  perform pg_temp.expect_error($q$ select public.react(pg_temp.uid('2a'), 'x', 'heart') $q$, 'USER_NOT_FOUND');
end $$;

-- 8. Profiles: friends compare brains; strangers can't look.
do $$
declare r jsonb;
begin
  r := public.get_social_profile(pg_temp.uid('2b'));
  assert r ->> 'relation' = 'friend' and (r ->> 'total_xp')::int = 1100, format('got %s', r);
  assert r -> 'skills' = '{"skill.science.testing": 1}'::jsonb, format('skill levels, got %s', r -> 'skills');
  assert exists (select 1 from jsonb_array_elements(r -> 'trophies') t where t ->> 'trophy_id' = 'trophy.first_level');
  perform pg_temp.expect_error($q$ select public.get_social_profile(pg_temp.uid('3b')) $q$, 'USER_NOT_FOUND');
end $$;

-- 9. Blocking ends the friendship and hides both sides from each other.
do $$ begin
  perform public.block_user(pg_temp.uid('2c'));
  assert jsonb_array_length(public.get_social() -> 'friends') = 1, 'Carol is no longer a friend';
  perform public.report_user(pg_temp.uid('2c'), 'username', 'rude name');
end $$;
select pg_temp.as_user(pg_temp.uid('2c')::text);
do $$
declare v_code text;
begin
  reset role;
  select invite_code into v_code from public.profiles where id = pg_temp.uid('2a');
  set role authenticated;
  assert public.find_user('alice_reads') is null, 'blocked: not found';
  perform pg_temp.expect_error(format('select public.accept_invite(%L)', v_code), 'INVITE_NOT_FOUND');
  perform pg_temp.expect_error($q$ select public.get_social_profile(pg_temp.uid('2a')) $q$, 'USER_NOT_FOUND');
end $$;

-- 9b. Avatars: every tree's is open from the start; gold needs the tree mastered.
select pg_temp.as_user(pg_temp.uid('2b')::text);
do $$ begin
  assert public.set_avatar('avatar.testing') ->> 'avatar' = 'avatar.testing', 'a tree avatar is open from the start';
  perform pg_temp.expect_error($q$ select public.set_avatar('avatar.testing.gold') $q$, 'AVATAR_LOCKED');
  perform pg_temp.expect_error($q$ select public.set_avatar('avatar.nope') $q$, 'AVATAR_NOT_FOUND');
  perform pg_temp.expect_error($q$ select public.set_avatar('<script>') $q$, 'AVATAR_NOT_FOUND');
end $$;
reset role;
update public.user_skill_progress set highest_cleared = 100 where user_id = pg_temp.uid('2b') and skill_id = 'skill.science.testing';
set role authenticated;
do $$ begin
  assert public.set_avatar('avatar.testing.gold') ->> 'avatar' = 'avatar.testing.gold', 'mastered: the gold one opens';
  assert public.get_social() -> 'me' ->> 'avatar' = 'avatar.testing.gold';
end $$;
-- Legendary avatars need their trophy: Bob has First Level but not Master of All.
do $$ begin
  perform pg_temp.expect_error($q$ select public.set_avatar('avatar.legendary.master_of_all') $q$, 'AVATAR_LOCKED');
  perform pg_temp.expect_error($q$ select public.set_avatar('avatar.legendary.nope') $q$, 'AVATAR_NOT_FOUND');
end $$;
select pg_temp.as_user(pg_temp.uid('2a')::text);
do $$ begin
  assert public.get_social_profile(pg_temp.uid('2b')) ->> 'avatar' = 'avatar.testing.gold', 'friends see it on cards and profiles';
  perform pg_temp.expect_error($q$ select public.set_avatar(null) $q$, 'AVATAR_NOT_FOUND');
end $$;

-- New accounts wear a starter tree avatar from the moment their profile exists.
reset role;
insert into auth.users (id) values (pg_temp.uid('4a'));
do $$ begin
  assert (select avatar from public.profiles where id = pg_temp.uid('4a')) ~ '^avatar\.[a-z_]+$', 'a starter avatar at sign-up';
end $$;
set role authenticated;

-- 9c. The username filter (mirrors core usernameFilter.test.ts) and moderation.
reset role;
do $$
declare v text;
begin
  foreach v in array array['grapefruit_fan', 'the_therapist', 'scunthorpe_utd', 'cocktail_hour', 'dickens_reader', 'cucumber_cool', 'sussex_sam',
    'class_act', 'peacock_42', 'badminton_pro', 'nightingale', 'mississippi', 'supportive_pal'] loop
    assert not public.username_blocked(v), format('%s should pass', v);
  end loop;
  foreach v in array array['xfuckx', 'fuuuck_you', 'f_u_c_k', 'sh1t_head', 'b00bs', 'big_dick', 'dick69', 'h1tler', 'kkk_member', 'grape_rapist',
    'n1gga', 'p0rn_star', 'brainscroll_support', 'admin_team'] loop
    assert public.username_blocked(v), format('%s should be refused', v);
  end loop;
end $$;
set role authenticated;
select pg_temp.as_user(pg_temp.uid('2d')::text);
do $$ begin
  perform pg_temp.expect_error($q$ select public.set_username('sh1t_head') $q$, 'USERNAME_NOT_ALLOWED');
  assert public.set_username('grapefruit_fan') ->> 'username' = 'grapefruit_fan', 'innocent words that contain a term are fine';
end $$;
reset role;
-- Every generated username passes the filter.
do $$
declare a text; n text;
begin
  foreach a in array array['curious', 'bright', 'clever', 'swift', 'bold', 'calm', 'keen', 'wise', 'sunny', 'lucky', 'brave', 'witty'] loop
    foreach n in array array['owl', 'fox', 'otter', 'panda', 'falcon', 'koala', 'lynx', 'heron', 'badger', 'whale', 'comet', 'atlas'] loop
      assert not public.username_blocked(a || '_' || n || '_1234'), format('generated %s_%s is refused', a, n);
    end loop;
  end loop;
end $$;
-- Nor is any generated username, whatever its number (8008 would read as a word).
do $$ begin
  for i in 1..5000 loop
    assert not public.username_blocked(public.generate_username()), 'a generated username is refused';
  end loop;
end $$;
-- A username set before a term was added shows up flagged; resetting it closes the username reports about it.
update public.profiles set username = 'old_badword' where id = pg_temp.uid('2e');
insert into public.username_terms (term, kind) values ('badword', 'anywhere');
insert into public.user_reports (user_id, reported_id, reason) values (pg_temp.uid('2d'), pg_temp.uid('2e'), 'username'), (pg_temp.uid('2f'), pg_temp.uid('2e'), 'cheating');
do $$
declare r jsonb; v text;
begin
  r := public.admin_flagged_usernames();
  assert r @> jsonb_build_array(jsonb_build_object('id', pg_temp.uid('2e'), 'username', 'old_badword')), format('flagged, got %s', r);
  r := public.admin_user_reports('open');
  assert (select count(*) from jsonb_array_elements(r) x where x ->> 'reported_id' = pg_temp.uid('2e')::text) = 2, format('two open reports, got %s', r);
  assert not (r -> 0 ? 'user_id'), 'the reporter is never shown';
  v := public.admin_reset_username(pg_temp.uid('2e')) ->> 'username';
  assert v ~ '^[a-z]+_[a-z]+_[0-9]{4}$' and (select username from public.profiles where id = pg_temp.uid('2e')) = v, 'a fresh generated username';
  assert (select status from public.user_reports where reported_id = pg_temp.uid('2e') and reason = 'username') = 'fixed', 'its username report is closed';
  assert (select status from public.user_reports where reported_id = pg_temp.uid('2e') and reason = 'cheating') = 'open', 'other reports stay open';
  perform public.admin_set_user_report_status((select id from public.user_reports where reported_id = pg_temp.uid('2e') and reason = 'cheating'), 'dismissed');
  assert not exists (select 1 from jsonb_array_elements(public.admin_user_reports('open')) x where x ->> 'reported_id' = pg_temp.uid('2e')::text), 'dismissed';
  assert not exists (select 1 from jsonb_array_elements(public.admin_flagged_usernames()) x where x ->> 'id' = pg_temp.uid('2e')::text), 'no longer flagged';
end $$;
delete from public.username_terms where term = 'badword';
-- Learners can't call moderation or read the term list.
set role authenticated;
select pg_temp.as_user(pg_temp.uid('2d')::text);
do $$ begin
  perform pg_temp.expect_error($q$ select public.admin_reset_username(pg_temp.uid('2e')) $q$, 'permission denied for function admin_reset_username');
  perform pg_temp.expect_error($q$ select public.admin_user_reports() $q$, 'permission denied for function admin_user_reports');
  perform pg_temp.expect_error($q$ select count(*) from public.username_terms $q$, 'permission denied for table username_terms');
end $$;

-- 10. Nothing social is readable directly.
do $$ begin
  assert (select count(*) from public.friendships) = 0 and (select count(*) from public.league_members) = 0
     and (select count(*) from public.feed_reactions) = 0 and (select count(*) from public.user_reports) = 0, 'RPC access only';
  perform pg_temp.expect_error($q$ insert into public.friendships (user_id, friend_id) values (pg_temp.uid('2c'), pg_temp.uid('2a')) $q$,
    'new row violates row-level security policy for table "friendships"');
end $$;
reset role;
\o
\echo 'social: all assertions passed'
