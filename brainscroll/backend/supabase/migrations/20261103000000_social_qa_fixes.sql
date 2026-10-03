-- Social fixes from QA (2026-10-03). Mirrors packages/core/src/social.ts,
-- packages/core/src/usernameFilter.ts and app/src/progress/localSocial.ts.
--
-- 1. Profiles are for friends and league mates only (CURRENT_PRODUCT_DECISIONS
--    §22). A pending request either way no longer opens one: it shows the
--    username and avatar, and nothing else ('limited').
-- 2. A blocked learner is hidden in your league: their row keeps its place and
--    weekly XP, but no id, username, avatar or level.
-- 3. Account deletion also removes other learners' pending and sent notes that
--    name the learner (notification_outbox params), so nothing about them is left.
-- 4. Reserved names (BrainScroll, Dr. Scroll) are checked on the whole name with
--    underscores dropped and look-alikes read as letters (dr_scroll, brain_scroll,
--    brainscroii, dr_scro11). Innocent phrases that span parts (cum_laude, sex_ed,
--    hoe_down, tit_for_tat, dick_grayson) pass; a few spellings (fvck, phuck, f0ck)
--    no longer do.
-- 5. report_user refuses yourself and unknown learners.
-- 6. get_blocked lists the learners you've blocked, so you can unblock them.
-- 7. Fewer, truer pushes: a friend request or a heart from the same person
--    queues one note a week at most (dedupe); a request that's withdrawn,
--    declined, accepted or crossed, a heart taken back, and a friendship ended
--    take their unsent notes with them; react() only takes a moment that exists
--    (the owner's last 14 days, as in the feed), so a made-up item_key can't
--    queue a push.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Profiles: friends and league mates only
-- ─────────────────────────────────────────────────────────────────────────────

-- A friend's or league mate's profile (or your own), to compare brains. A
-- learner you've only sent a request to, or who sent you one, shows just their
-- username and avatar ('limited': true), so a request never unlocks a profile.
create or replace function public.get_social_profile(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_open boolean;
  v_rel text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_user is null or not exists (select 1 from public.profiles where id = p_user)
     or (p_user <> v_uid and public.blocked_between(v_uid, p_user)) then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Friends and current league mates (social_circle already leaves out anyone blocked).
  v_open := p_user = v_uid or exists (select 1 from public.social_circle(v_uid) c where c.user_id = p_user);
  v_rel := case
    when p_user = v_uid then 'you'
    when exists (select 1 from public.friendships where user_id = v_uid and friend_id = p_user) then 'friend'
    when exists (select 1 from public.friend_requests where user_id = v_uid and to_id = p_user) then 'requested'
    when exists (select 1 from public.friend_requests where user_id = p_user and to_id = v_uid) then 'asked_you'
    when v_open then 'league'
  end;
  if v_rel is null then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if not v_open then
    return (select jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar, 'relation', v_rel, 'limited', true)
            from public.profiles p where p.id = p_user);
  end if;
  return public.social_card(p_user) || jsonb_build_object(
    'relation', v_rel,
    'limited', false,
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_events where user_id = p_user),
    'streak', public.learning_streak(p_user),
    'trophies', (
      select coalesce(jsonb_agg(t), '[]') from (
        select x ->> 'trophy_id' as trophy_id, x ->> 'earned_at' as earned_at from jsonb_array_elements(public.milestone_trophies(p_user)) x
        union all
        select trophy_id, earned_at::text from public.user_trophies where user_id = p_user
      ) t),
    'skills', (select coalesce(jsonb_object_agg(skill_id, highest_cleared), '{}') from public.user_skill_progress where user_id = p_user and highest_cleared > 0)
  );
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Leagues: a blocked learner is a hidden row
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_league() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_week date := public.league_week_start(now());
  v_last jsonb;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform public.ensure_social_identity(v_uid);
  perform public.finalize_leagues_of(v_uid);
  v_id := public.join_league(v_uid);
  select jsonb_build_object('week_start', l.week_start, 'place', e.reason, 'xp', e.amount) into v_last
  from public.league_members m join public.leagues l on l.id = m.league_id
  left join public.xp_events e on e.user_id = v_uid and e.idempotency_key = 'league_finish:' || l.id
  where m.user_id = v_uid and l.week_start < v_week
  order by l.week_start desc limit 1;
  return jsonb_build_object(
    'league_id', v_id,
    'week_start', v_week,
    'ends_at', public.week_start_at(v_week + 7),
    'members', (
      select coalesce(jsonb_agg(
               case when m.user_id <> v_uid and public.blocked_between(v_uid, m.user_id)
                 -- Blocked either way: their place and XP still count, but nothing says who they are.
                 then jsonb_build_object('id', null, 'username', null, 'avatar', null, 'knowledge_level', null,
                                         'weekly_xp', public.weekly_xp(m.user_id, v_week), 'you', false, 'blocked', true)
                 else public.social_card(m.user_id) || jsonb_build_object('you', m.user_id = v_uid, 'blocked', false)
               end
               order by public.weekly_xp(m.user_id, v_week) desc, m.joined_at, m.user_id), '[]')
      from public.league_members m where m.league_id = v_id),
    'last_week', v_last
  );
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Account deletion: other learners' notes about the learner go too
-- ─────────────────────────────────────────────────────────────────────────────

-- Their own rows cascade through profiles; notes queued for someone else that
-- name them (a request, a new friend, a heart, a pass) are removed here, on
-- every path that deletes a profile.
create or replace function public.forget_social_mentions() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.notification_outbox where params ->> 'user_id' = old.id::text;
  return old;
end $$;
create trigger profiles_forget_social_mentions before delete on public.profiles
  for each row execute function public.forget_social_mentions();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. The username filter: reserved names on the whole name, phrases, more terms
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.username_terms drop constraint username_terms_kind_check;
alter table public.username_terms add constraint username_terms_kind_check
  check (kind in ('anywhere', 'word', 'allowed', 'reserved', 'phrase'));

-- BrainScroll and Dr. Scroll move from 'anywhere' to 'reserved' (checked on the whole name).
delete from public.username_terms where term in ('brainscroll', 'drscroll');
insert into public.username_terms (term, kind) values
  ('brainscroll', 'reserved'), ('drscroll', 'reserved'), ('doctorscroll', 'reserved'),
  ('fvck', 'anywhere'), ('phuck', 'anywhere'), ('fock', 'anywhere'),
  ('rapeseed', 'allowed'), ('pussycat', 'allowed'),
  ('cumlaude', 'phrase'), ('sexed', 'phrase'), ('hoedown', 'phrase'), ('titfortat', 'phrase'), ('dickgrayson', 'phrase');

-- How it reads a name (mirrors core usernameBlocked):
-- - reserved terms are looked for in the whole name, underscores dropped,
--   look-alike digits as letters and i/l/1 as one letter (brainscroii, dr_scro11);
-- - phrase terms are cut out first, their letters may be split by underscores
--   (cum_laude, sex_ed), so their words don't count on their own;
-- - then as before: parts at underscores, one-letter runs joined, 'anywhere'
--   terms inside a part (minus 'allowed' words), 'word' terms as a whole part.
create or replace function public.username_blocked(p_name text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_name text := lower(trim(p_name));
  v_any text := public.username_term_pattern('anywhere');
  v_allowed text := public.username_term_pattern('allowed');
  v_reserved text := (select string_agg(regexp_replace(translate(term, 'i', 'l'), '([a-z])', '\1+', 'g'), '|') from public.username_terms where kind = 'reserved');
  v_phrase text := (select string_agg(regexp_replace(regexp_replace(term, '([a-z])', '\1+_*', 'g'), '_\*$', ''), '|') from public.username_terms where kind = 'phrase');
  v_parts text[] := '{}';
  v_run text := '';
  p text;
  v_read text;
begin
  if v_reserved is not null
     and translate(regexp_replace(translate(v_name, '01345789', 'oieastbg'), '[^a-z]', '', 'g'), 'i', 'l') ~ v_reserved then
    return true;
  end if;
  if v_phrase is not null then v_name := regexp_replace(v_name, v_phrase, '_', 'g'); end if;

  foreach p in array string_to_array(v_name, '_') loop
    if length(p) = 1 then
      v_run := v_run || p;
    else
      if v_run <> '' then v_parts := v_parts || v_run; end if;
      v_run := '';
      if p <> '' then v_parts := v_parts || p; end if;
    end if;
  end loop;
  if v_run <> '' then v_parts := v_parts || v_run; end if;

  foreach p in array v_parts loop
    v_read := regexp_replace(translate(p, '01345789', 'oieastbg'), '[^a-z]', '', 'g');
    -- Allowed words are cut out first, so grapes passes and grape_rapist doesn't.
    if v_any is not null and regexp_replace(v_read, coalesce(v_allowed, '^$'), '_', 'g') ~ v_any then return true; end if;
    if exists (select 1 from public.username_terms t
               where t.kind = 'word'
                 and (t.term in (v_read, regexp_replace(v_read, '(.)\1+', '\1', 'g')) or t.term = any (regexp_split_to_array(p, '[^a-z]+')))) then
      return true;
    end if;
  end loop;
  return false;
end $$;
revoke execute on function public.username_blocked(text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 and 6. Reports and blocks
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.report_user(p_user uuid, p_reason text, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_user is null or p_user = v_uid or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if (select count(*) from public.user_reports where user_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = '54000';
  end if;
  insert into public.user_reports (user_id, reported_id, reason, note) values (v_uid, p_user, p_reason, nullif(trim(p_note), ''));
end $$;

-- The learners you've blocked, newest first, so Settings can offer to unblock them.
create or replace function public.get_blocked() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar) order by b.created_at desc), '[]')
          from public.user_blocks b join public.profiles p on p.id = b.blocked_id where b.user_id = v_uid);
end $$;
revoke execute on function public.get_blocked() from public, anon;
grant execute on function public.get_blocked() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Pushes that stay true, and hearts on moments that exist
-- ─────────────────────────────────────────────────────────────────────────────

-- A learner's feed moments since p_since (what get_feed shows for each person).
create or replace function public.feed_moments(p_uid uuid, p_since timestamptz)
returns table (kind text, item_key text, at timestamptz, data jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  -- Trophies (milestones, mastery, subjects) and quest trophies.
  select 'trophy'::text, 'trophy:' || (x ->> 'trophy_id'), (x ->> 'earned_at')::timestamptz, jsonb_build_object('trophy_id', x ->> 'trophy_id')
  from jsonb_array_elements(public.milestone_trophies(p_uid)) x
  where (x ->> 'earned_at')::timestamptz >= p_since
  union all
  select 'trophy', 'trophy:' || t.trophy_id, t.earned_at, jsonb_build_object('trophy_id', t.trophy_id, 'name', t.name)
  from public.user_trophies t where t.user_id = p_uid and t.earned_at >= p_since
  -- Chapters finished: every 10th level.
  union all
  select 'chapter', 'chapter:' || lp.level_id, lp.completed_at, jsonb_build_object('skill_id', l.skill_id, 'chapter', l.number / 10)
  from public.user_level_progress lp join public.levels l on l.id = lp.level_id and l.number % 10 = 0
  where lp.user_id = p_uid and lp.completed_at >= p_since
  -- Streak milestones: the day a run reached 3, 7, 14, 30 ... days.
  union all
  select 'streak', 'streak:' || r.k || ':' || r.d, r.at, jsonb_build_object('days', r.k)
  from (
    select d, at, row_number() over (partition by grp order by d)::int as k
    from (
      select ld.day as d, ld.first_at as at, ld.day - (row_number() over (order by ld.day))::int as grp
      from public.user_learning_days ld where ld.user_id = p_uid
    ) runs
  ) r
  where r.at >= p_since and r.k = any (public.streak_feed_milestones())
  -- League podiums.
  union all
  select 'league', 'league:' || e.idempotency_key, e.created_at, jsonb_build_object('reason', e.reason, 'xp', e.amount)
  from public.xp_events e where e.user_id = p_uid and e.type = 'LEAGUE_FINISH' and e.created_at >= p_since
$$;
revoke execute on function public.feed_moments(uuid, timestamptz) from public, anon, authenticated;

-- The last 14 days of moments from you, your friends and your league mates, newest first. Unchanged output.
create or replace function public.get_feed() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - interval '14 days';
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  return (
    with people as (
      select v_uid as uid, false as is_friend union all select user_id, is_friend from public.social_circle(v_uid)
    ),
    items as (
      select p.uid, m.kind, m.item_key, m.at, m.data from people p cross join lateral public.feed_moments(p.uid, v_since) m
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'owner', public.social_card(i.uid) || jsonb_build_object('you', i.uid = v_uid, 'friend', pe.is_friend),
      'kind', i.kind, 'key', i.item_key, 'at', i.at, 'data', i.data,
      'reactions', (select coalesce(jsonb_object_agg(reaction, n), '{}') from (
                     select reaction, count(*) as n from public.feed_reactions fr
                     where fr.owner_id = i.uid and fr.item_key = i.item_key and not public.blocked_between(v_uid, fr.user_id)
                     group by reaction) rc),
      'mine', (select reaction from public.feed_reactions fr where fr.owner_id = i.uid and fr.item_key = i.item_key and fr.user_id = v_uid)
    ) order by i.at desc), '[]')
    from (select * from items order by at desc limit 60) i join people pe on pe.uid = i.uid
  );
end $$;

-- A heart on someone's moment (null takes it back). Only for people you can see,
-- and only on a moment of theirs from the last 14 days.
create or replace function public.react(p_owner uuid, p_item_key text, p_reaction text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_owner = v_uid or not exists (select 1 from public.social_circle(v_uid) c where c.user_id = p_owner) then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_reaction is null then
    delete from public.feed_reactions where owner_id = p_owner and item_key = p_item_key and user_id = v_uid;
  else
    if not exists (select 1 from public.feed_moments(p_owner, now() - interval '14 days') m where m.item_key = p_item_key) then
      raise exception 'MOMENT_NOT_FOUND' using errcode = 'P0002';
    end if;
    insert into public.feed_reactions (user_id, owner_id, item_key, reaction) values (v_uid, p_owner, p_item_key, p_reaction)
    on conflict (owner_id, item_key, user_id) do update set reaction = excluded.reaction, created_at = now();
  end if;
end $$;

-- A request: the other side hears about it, once a week at most per person
-- (asking, being turned down and asking again doesn't ping them each time).
create or replace function public.push_on_friend_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.blocked_between(new.user_id, new.to_id)
     and not exists (select 1 from public.notification_outbox o
                     where o.user_id = new.to_id and o.kind = 'friend_request' and o.status in ('pending', 'sent')
                       and o.params ->> 'user_id' = new.user_id::text and o.created_at > now() - interval '7 days') then
    perform public.enqueue_push(new.to_id, 'friend_request',
      jsonb_build_object('user_id', new.user_id, 'username', (select username from public.profiles where id = new.user_id)));
  end if;
  return new;
end $$;

-- A request that's gone (withdrawn, declined, accepted, crossed or blocked): its unsent note goes too.
create or replace function public.push_forget_friend_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.notification_outbox
  where user_id = old.to_id and kind = 'friend_request' and status = 'pending' and params ->> 'user_id' = old.user_id::text;
  return old;
end $$;
create trigger friend_requests_push_forget after delete on public.friend_requests
  for each row execute function public.push_forget_friend_request();

-- A friendship that ends: an unsent "you're friends" note goes too.
create or replace function public.push_forget_friendship() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.notification_outbox
  where user_id = old.user_id and kind = 'friend_new' and status = 'pending' and params ->> 'user_id' = old.friend_id::text;
  return old;
end $$;
create trigger friendships_push_forget after delete on public.friendships
  for each row execute function public.push_forget_friendship();

-- A heart: the owner hears about it, once per person and moment (liking,
-- unliking and liking again doesn't ping twice).
create or replace function public.push_on_reaction() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.user_id <> new.owner_id
     and not exists (select 1 from public.notification_outbox o
                     where o.user_id = new.owner_id and o.kind = 'reaction' and o.status in ('pending', 'sent')
                       and o.params ->> 'user_id' = new.user_id::text and o.params ->> 'item_key' = new.item_key
                       and o.created_at > now() - interval '7 days') then
    perform public.enqueue_push(new.owner_id, 'reaction',
      jsonb_build_object('user_id', new.user_id, 'username', (select username from public.profiles where id = new.user_id), 'item_key', new.item_key));
  end if;
  return new;
end $$;

-- A heart taken back: its unsent note goes too.
create or replace function public.push_forget_reaction() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.notification_outbox
  where user_id = old.owner_id and kind = 'reaction' and status = 'pending'
    and params ->> 'user_id' = old.user_id::text and params ->> 'item_key' = old.item_key;
  return old;
end $$;
create trigger feed_reactions_push_forget after delete on public.feed_reactions
  for each row execute function public.push_forget_reaction();

revoke execute on function public.forget_social_mentions(), public.push_on_friend_request(), public.push_forget_friend_request(),
  public.push_forget_friendship(), public.push_on_reaction(), public.push_forget_reaction() from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array['get_league()', 'report_user(uuid, text, text)', 'get_social_profile(uuid)', 'get_feed()', 'react(uuid, text, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
